import React, { useEffect, useMemo, useState } from "react";
import type { AppState, MonthRecord, Subject } from "../types";

export default function AddEntryRow({
    state,
    record,
    onAdd
}: {
    state: AppState;
    record: MonthRecord;
    onAdd: (subjectId: string) => void;
}) {
    const [pick, setPick] = useState<string>("");

    const candidates = useMemo<Subject[]>(() => {
        const used = new Set(record.entries.map((e) => e.subjectId));
        return state.subjects.filter((s) => !used.has(s.id));
    }, [record.entries, state.subjects]);

    useEffect(() => {
        if (!pick && candidates[0]?.id) setPick(candidates[0].id);
        if (pick && !candidates.some((s) => s.id === pick)) setPick(candidates[0]?.id ?? "");
    }, [pick, candidates, record.month]);

    return (
        <div className="row wrap" style={{ gap: 8, alignItems: "center" }}>
            <span className="badge">新增条目</span>
            <select value={pick} onChange={(e) => setPick(e.target.value)} disabled={candidates.length === 0}>
                {candidates.length === 0 ? (
                    <option value="">（无可添加科目）</option>
                ) : (
                    candidates.map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.name} · {s.bucket}
                        </option>
                    ))
                )}
            </select>
            <button className="btn" disabled={!pick} onClick={() => pick && onAdd(pick)}>
                添加到当月
            </button>
            <span className="muted2" style={{ fontSize: 12 }}>
                先在「设置」里新增科目，再回这里添加条目
            </span>
        </div>
    );
}
