import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useScriptStore } from "../store/useScriptStore";
import ScriptEditor from "../components/ScriptEditor";

export default function ScriptPage() {
  const params = useParams();
  const id = params.id ?? null;

  const { setBlocks, setScriptId, setTitle } = useScriptStore();

  useEffect(() => {
    if (!id) return;

    async function loadScript() {
      const { data, error } = await supabase
        .from("scripts")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error(error);
        return;
      }

      setScriptId(id);
      setBlocks(data?.blocks || []);
      setTitle(data?.title || "Untitled Script");
    }

    loadScript();
  }, [id, setBlocks, setScriptId, setTitle]);

  return <ScriptEditor />;
}