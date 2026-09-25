import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DomusProvider } from "@/context/DomusContext";
import { Toaster } from "@/components/ui/sonner";
import SolInvictus from "@/pages/SolInvictus";
import Terminus from "@/pages/Terminus";
import Wall from "@/pages/Wall";
import Layout from "@/components/Layout";

function App() {
  return (
    <DomusProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/sol-invictus" replace />} />
            <Route path="/sol-invictus" element={<SolInvictus />} />
            <Route path="/terminus" element={<Terminus />} />
          </Route>
          <Route path="/wall/:gridId" element={<Wall />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </DomusProvider>
  );
}

export default App;
