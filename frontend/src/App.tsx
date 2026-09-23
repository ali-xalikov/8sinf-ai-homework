import { useApp } from "./store";
import { useRoute } from "./router";
import { useOnline, OfflineScreen } from "./components/Offline";
import { Layout } from "./components/Layout";
import { Auth } from "./views/Auth";
import { Home } from "./views/Home";
import { Books } from "./views/Books";
import { PdfViewer } from "./views/PdfViewer";
import { Ai } from "./views/Ai";
import { Answers } from "./views/Answers";
import { History } from "./views/History";
import { Profile } from "./views/Profile";
import { Admin } from "./views/Admin";
import { Share } from "./views/Share";
import { Chat } from "./views/Chat";

function Loading() {
  return (
    <div className="auth-screen">
      <div className="card" style={{ minWidth: 200, textAlign: "center" }}>
        <div className="spinner" />
        <p style={{ color: "var(--muted)" }}>Yuklanmoqda…</p>
      </div>
    </div>
  );
}

export default function App() {
  const { user, initialized } = useApp();
  const route = useRoute();
  const online = useOnline();

  if (route.name === "share" && route.params.token) {
    return <Share token={route.params.token} />;
  }

  if (!initialized) return <Loading />;

  if (!user) return <Auth />;

  if (!online) {
    return (
      <OfflineScreen
        onRetry={() => {
          window.location.reload();
        }}
      />
    );
  }

  const page = route.name;

  let view;
  if (page === "home") view = <Home key="home" />;
  else if (page === "books") view = <Books key="books" />;
  else if (page === "book" && route.params.id)
    view = <PdfViewer key={route.params.id} bid={route.params.id} pageParam={route.params.page} />;
  else if (page === "ai") view = <Ai key="ai" />;
  else if (page === "chat") view = <Chat key={"chat-" + (route.params.id || "")} initialId={route.params.id || ""} />;
  else if (page === "answers") view = <Answers key="answers" />;
  else if (page === "history") view = <History key="history" initialId={route.params.id || ""} />;
  else if (page === "saved") view = <History key="saved" savedOnly />;
  else if (page === "profile") view = <Profile key="profile" />;
  else if (page === "admin") view = user.role === "admin" ? <Admin key="admin" /> : <Home key="home" />;
  else view = <Home key="home" />;

  return <Layout route={route}>{view}</Layout>;
}