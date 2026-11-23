import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Star, PenTool } from "lucide-react";
import { api } from "../api";
import { useToast } from "../ui";
import SignatureBuilder from "../SignatureBuilder";
import { adaptSignature } from "../signatureTemplates";
import SignatureCopy from "../SignatureCopy";
import "../compose-extras.css";
export default function Signatures() {
  const toast = useToast();
  const [list, setList] = useState(null),
    [ed, setEd] = useState(null);
  const load = () =>
    api
      .get("/api/signatures")
      .then(setList)
      .catch((e) => toast(e.message, "err"));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line
  const setDefault = async (id) => {
    try {
      await api.post(`/api/signatures/${id || "none"}/default`);
      toast(id ? "Default signature set" : "Default removed");
      load();
    } catch (e) {
      toast(e.message, "err");
    }
  };
  const remove = async (s) => {
    if (!confirm(`Delete the signature "${s.name}"?`)) return;
    try {
      await api.del(`/api/signatures/${s.id}`);
      toast("Signature deleted");
      load();
    } catch (e) {
      toast(e.message, "err");
    }
  };
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Signatures</h1>
          <p className="muted">
            Create and manage signatures in Hamim’s signature style. Choose one
            when importing a batch or composing an email.
          </p>
        </div>
        <button className="btn primary" onClick={() => setEd({})}>
          <Plus size={16} /> New signature
        </button>
      </header>
      {ed && (
        <SignatureBuilder
          initial={ed.id ? ed : null}
          onCancel={() => setEd(null)}
          onSaved={() => {
            setEd(null);
            load();
          }}
        />
      )}
      <section className="sig-cards">
        {!list ? (
          <div className="spinner" />
        ) : list.length === 0 && !ed ? (
          <div className="card" style={{ padding: 24, textAlign: "center" }}>
            <PenTool size={28} />
            <h3>No signatures yet</h3>
          </div>
        ) : (
          list.map((s) => {
            const adapted = adaptSignature(s);
            return (
              <div key={s.id} className="card sig-card">
                <div className="sig-card-head">
                  <strong>{s.name}</strong>
                  {s.isDefault && (
                    <span className="sig-default">
                      <Star size={12} /> Default
                    </span>
                  )}
                </div>
                <div
                  className="sig-preview"
                  dangerouslySetInnerHTML={{ __html: adapted.html }}
                />
                <div className="sig-actions">
                  {s.isDefault ? (
                    <button className="btn" onClick={() => setDefault(null)}>
                      Remove default
                    </button>
                  ) : (
                    <button className="btn" onClick={() => setDefault(s.id)}>
                      <Star size={14} /> Set as default
                    </button>
                  )}
                  <button
                    className="btn"
                    onClick={() =>
                      setEd({
                        id: s.id,
                        name: s.name,
                        templateId: "hamim-signature",
                        fields: adapted.fields,
                      })
                    }
                  >
                    <Pencil size={14} /> Edit
                  </button>
                  <button className="btn danger-o" onClick={() => remove(s)}>
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
                <SignatureCopy signature={adapted} />
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
