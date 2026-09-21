from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass
from typing import Dict, List, Optional

import numpy as np

from .db import norm_text


def _tokens(text: str):
    t = norm_text(text)
    t = re.sub(r"\s+", " ", t)
    n = len(t)
    for i in range(n - 2):
        gram = t[i : i + 3]
        if gram and not gram.isspace():
            yield gram


@dataclass
class ChunkRecord:
    book_id: str
    page_no: int
    chunk_idx: int
    text: str


@dataclass
class MatchedChunk:
    book_id: str
    page_no: int
    chunk_idx: int
    text: str
    score: float


class VectorIndex:
    """Char 3-gramma TF-IDF vektor indeks — semantic-ish qidiruv (oflayn)."""

    def __init__(self) -> None:
        self.records: List[ChunkRecord] = []
        self.vocab: Dict[str, int] = {}
        self._matrix: Optional[np.ndarray] = None

    def clear(self) -> None:
        self.records = []
        self.vocab = {}
        self._matrix = None

    def build(self, records: List[ChunkRecord]) -> None:
        self.records = records
        N = len(records)
        if N == 0:
            self.vocab = {}
            self._matrix = None
            return
        df: Counter = Counter()
        tf_rows: List[Counter] = []
        for rec in records:
            c: Counter = Counter()
            for tok in _tokens(rec.text):
                c[tok] += 1
            tf_rows.append(c)
            for tok in c:
                df[tok] += 1

        max_doc_frac = 0.9
        vocab_list = [t for t, d in df.items() if (d / N) <= max_doc_frac]
        self.vocab = {t: i for i, t in enumerate(vocab_list)}
        V = len(vocab_list)
        self._matrix = None
        if V < 4:
            return

        dense = np.zeros((N, V), dtype=np.float32)
        for i, c in enumerate(tf_rows):
            s = 0.0
            for tok, tf in c.items():
                j = self.vocab.get(tok)
                if j is None:
                    continue
                idf = math.log((N + 1) / (df[tok] + 1)) + 1.0
                v = tf * idf
                dense[i, j] = v
                s += v * v
            nrm = math.sqrt(s)
            if nrm > 0:
                dense[i] = dense[i] / nrm
        self._matrix = dense

    def search(self, query: str, top_k: int = 10) -> List[MatchedChunk]:
        if self._matrix is None or not self.records:
            return []
        qcount: Counter = Counter()
        for t in _tokens(query):
            qcount[t] += 1
        qv = np.zeros(self._matrix.shape[1], dtype=np.float32)
        for tok, c in qcount.items():
            j = self.vocab.get(tok)
            if j is not None:
                qv[j] = c
        nrm = float(np.dot(qv, qv))
        if nrm <= 0:
            return []
        qv = qv / math.sqrt(nrm)
        scores = self._matrix @ qv
        top = np.argsort(-scores)[:top_k].tolist()
        out: List[MatchedChunk] = []
        for idx in top:
            s = float(scores[idx])
            if s <= 0.0:
                continue
            rec = self.records[idx]
            out.append(MatchedChunk(rec.book_id, rec.page_no, rec.chunk_idx, rec.text, s))
        return out


_global_index: VectorIndex = VectorIndex()


def get_global_index() -> VectorIndex:
    return _global_index


def rebuild_global_indexes() -> dict:
    rows = storage_exec_chunks()
    records = [ChunkRecord(r["book_id"], r["page_no"], r["chunk_idx"], r["text"]) for r in rows]
    _global_index.build(records)
    return {"chunks": len(records), "books": len({r.book_id for r in records}), "ready": _global_index._matrix is not None}


def storage_exec_chunks():
    from . import db as _d  # noqa: F401
    from . import storage
    return storage.exec_all(
        """SELECT ch.book_id, ch.page_no, ch.chunk_idx, ch.text
           FROM chunks ch JOIN books b ON b.id = ch.book_id
           WHERE b.class_no = 8 AND b.indexed = 1
           ORDER BY b.subject_id, ch.book_id, ch.page_no, ch.chunk_idx"""
    )