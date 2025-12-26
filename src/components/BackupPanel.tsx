import React, { useCallback, useState } from "react";
import type { AppState } from "../types";
import { SCHEMA_VERSION } from "../lib/constants";
import { isRecord, validateAppStateLike } from "../lib/guards";

export default function BackupPanel({
  state,
  setState
}: {
  state: AppState;
  setState: (s: AppState) => void;
}) {
  const [json, setJson] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);

  const exportToTextarea = useCallback(() => {
    setJson(JSON.stringify({ schemaVersion: SCHEMA_VERSION, state }, null, 2));
  }, [state]);

  const downloadJson = useCallback(() => {
    const content = JSON.stringify({ schemaVersion: SCHEMA_VERSION, state }, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    const timestamp = new Date().toISOString().split("T")[0];
    link.href = url;
    link.download = `backup_${timestamp}.json`;
    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [state]);

  const parseCandidate = useCallback((text: string): AppState | null => {
    try {
      const raw: unknown = JSON.parse(text);

      const candidate: unknown =
        isRecord(raw) && typeof (raw as any).schemaVersion === "number" && (raw as any).state !== undefined
          ? (raw as any).state
          : raw;

      if (!validateAppStateLike(candidate)) return null;
      return candidate;
    } catch {
      return null;
    }
  }, []);

  const importJson = useCallback(() => {
    const candidate = parseCandidate(json);
    if (!candidate) {
      alert("导入失败：JSON 结构不符合 AppState（subjects/months/settings）或解析失败");
      return;
    }
    setState(candidate);
    alert("导入成功");
  }, [json, parseCandidate, setState]);

  const importFromFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      setJson(text);

      const candidate = parseCandidate(text);
      if (!candidate) {
        alert("导入失败：文件内容不符合 AppState（subjects/months/settings）");
        return;
      }
      setState(candidate);
      alert(`导入成功：${file.name}`);
    },
    [parseCandidate, setState]
  );

  const pickFile = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) importFromFile(f);
    };
    input.click();
  }, [importFromFile]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) importFromFile(f);
    },
    [importFromFile]
  );

  return (
    <div className="card pad" style={{ background: "rgba(255,255,255,.04)" }}>
      <div className="row wrap" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
          备份
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={exportToTextarea}>
            导出
          </button>
          <button className="btn" onClick={downloadJson}>
            下载
          </button>
          <button className="btn" onClick={importJson}>
            导入
          </button>
          <button className="btn primary" onClick={pickFile}>
            上传 JSON 导入
          </button>
        </div>
      </div>

      <div
        style={{
          marginTop: 10,
          border: dragOver ? "1px dashed rgba(255,255,255,.6)" : "1px dashed rgba(255,255,255,.25)",
          borderRadius: 12,
          padding: 10,
          background: dragOver ? "rgba(255,255,255,.05)" : "transparent"
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        title="支持把 .json 文件拖进来导入"
      >
        <textarea
          className="input"
          placeholder="点击“导出”查看内容，或在此粘贴 JSON 进行导入...（也支持拖拽 .json 文件到这里）"
          style={{ height: 220, width: "100%" }}
          value={json}
          onChange={(e) => setJson(e.target.value)}
        />

        <div className="note" style={{ marginTop: 8 }}>
          建议每月录入后下载一份 JSON 文件作为离线备份。
        </div>
      </div>
    </div>
  );
}
