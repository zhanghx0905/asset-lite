import React, { useCallback, useState } from "react";
import type { AppState, Subject, Currency } from "../types";
import { genId } from "../lib/id";

export default function SubjectsEditor({
    state,
    setState,
    onDeleteSubject,
    onAddSubject
}: {
    state: AppState;
    setState: React.Dispatch<React.SetStateAction<AppState>>;
    onDeleteSubject: (id: string) => void;
    onAddSubject: (subject: Subject) => void;
}) {
    const updateSubject = useCallback(
        (id: string, patch: Partial<Subject>) => {
            setState((prev) => ({
                ...prev,
                subjects: prev.subjects.map((s) => (s.id === id ? { ...s, ...patch } : s))
            }));
        },
        [setState]
    );

    const [newName, setNewName] = useState<string>("");
    const [newBucket, setNewBucket] = useState<Subject["bucket"]>("Cash");
    const [newCurrency, setNewCurrency] = useState<Currency>("CNY");
    const [newIndexLike, setNewIndexLike] = useState<boolean>(false);
    const [newIncludeNW, setNewIncludeNW] = useState<boolean>(true);

    const add = useCallback(() => {
        const name = newName.trim();
        if (!name) return;

        onAddSubject({
            id: genId("sub"),
            name,
            bucket: newBucket,
            defaultCurrency: newCurrency,
            isIndexLike: newIndexLike,
            includeInNetWorth: newIncludeNW
        });

        setNewName("");
        setNewBucket("Cash");
        setNewCurrency("CNY");
        setNewIndexLike(false);
        setNewIncludeNW(true);
    }, [newName, newBucket, newCurrency, newIndexLike, newIncludeNW, onAddSubject]);

    return (
        <div className="card pad" style={{ background: "rgba(255,255,255,.04)" }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
                科目
            </div>

            <div className="row wrap" style={{ gap: 8, alignItems: "center", marginBottom: 10 }}>
                <span className="badge">新增科目</span>
                <input
                    className="input"
                    style={{ width: 260 }}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="科目名称，例如：微信、支付宝、微众银行、应收账款…"
                />
                <select value={newBucket} onChange={(e) => setNewBucket(e.target.value as Subject["bucket"])}>
                    <option value="Cash">Cash</option>
                    <option value="Invest">Invest</option>
                    <option value="Social">Social</option>
                    <option value="Other">Other</option>
                </select>
                <select value={newCurrency} onChange={(e) => setNewCurrency(e.target.value as Currency)}>
                    <option value="CNY">CNY</option>
                    <option value="USD">USD</option>
                </select>
                <label className="badge" style={{ cursor: "pointer" }}>
                    <input type="checkbox" checked={newIndexLike} onChange={(e) => setNewIndexLike(e.target.checked)} />
                    指数类
                </label>
                <label className="badge" style={{ cursor: "pointer" }}>
                    <input type="checkbox" checked={newIncludeNW} onChange={(e) => setNewIncludeNW(e.target.checked)} />
                    计入净资产
                </label>
                <button className="btn primary" onClick={add} disabled={!newName.trim()}>
                    添加
                </button>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
                {state.subjects.map((s) => (
                    <div
                        key={s.id}
                        style={{
                            display: "grid",
                            gridTemplateColumns: "160px 1fr 140px 120px 220px",
                            gap: 8,
                            alignItems: "center"
                        }}
                    >
                        <div className="badge" title={s.id}>
                            {s.id}
                        </div>
                        <input className="input" value={s.name} onChange={(e) => updateSubject(s.id, { name: e.target.value })} />
                        <select value={s.bucket} onChange={(e) => updateSubject(s.id, { bucket: e.target.value as Subject["bucket"] })}>
                            <option value="Cash">Cash</option>
                            <option value="Invest">Invest</option>
                            <option value="Social">Social</option>
                            <option value="Other">Other</option>
                        </select>
                        <select
                            value={s.defaultCurrency}
                            onChange={(e) => updateSubject(s.id, { defaultCurrency: e.target.value as Currency })}
                        >
                            <option value="CNY">CNY</option>
                            <option value="USD">USD</option>
                        </select>

                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <label className="badge" style={{ cursor: "pointer" }}>
                                <input
                                    type="checkbox"
                                    checked={!!s.isIndexLike}
                                    onChange={(e) => updateSubject(s.id, { isIndexLike: e.target.checked })}
                                />
                                指数类
                            </label>
                            <label className="badge" style={{ cursor: "pointer" }}>
                                <input
                                    type="checkbox"
                                    checked={s.includeInNetWorth !== false}
                                    onChange={(e) => updateSubject(s.id, { includeInNetWorth: e.target.checked })}
                                />
                                计入净资产
                            </label>
                            <button
                                className="btn"
                                onClick={() => {
                                    const ok = confirm(`删除科目「${s.name}」？将同时移除所有月份的对应条目。`);
                                    if (ok) onDeleteSubject(s.id);
                                }}
                            >
                                删除
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
