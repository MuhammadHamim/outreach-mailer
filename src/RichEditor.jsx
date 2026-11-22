import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link2,
  Highlighter,
  RemoveFormatting,
  Undo2,
  Redo2,
} from "lucide-react";
import "./compose-extras.css";

// value = initial HTML (read once). onChange(html, plainText) fires on every edit.
export default function RichEditor({ value = "", onChange, minHeight = 220 }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer" },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
    content: value,
    onUpdate: ({ editor: ed }) => onChange?.(ed.getHTML(), ed.getText()),
    editorProps: {
      attributes: { class: "rte-area", style: `min-height:${minHeight}px` },
    },
  });
  if (!editor) return null;

  const T = ({ on, act, title, children }) => (
    <button
      type="button"
      className={`rte-btn ${act ? "on" : ""}`}
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={on}
    >
      {children}
    </button>
  );
  const c = () => editor.chain().focus();
  const setLink = () => {
    const prev = editor.getAttributes("link").href || "";
    const href = window.prompt("Link URL (leave empty to remove)", prev);
    if (href === null) return;
    if (!href.trim()) return c().extendMarkRange("link").unsetLink().run();
    c()
      .extendMarkRange("link")
      .setLink({
        href: /^(https?:|mailto:|tel:)/i.test(href) ? href : `https://${href}`,
      })
      .run();
  };
  const block = editor.isActive("heading", { level: 2 })
    ? "h2"
    : editor.isActive("heading", { level: 3 })
      ? "h3"
      : "p";

  return (
    <div className="rte">
      <div className="rte-bar">
        <T on={() => c().undo().run()} title="Undo">
          <Undo2 size={15} />
        </T>
        <T on={() => c().redo().run()} title="Redo">
          <Redo2 size={15} />
        </T>
        <span className="rte-sep" />
        <select
          className="rte-select"
          value={block}
          onChange={(e) =>
            e.target.value === "p"
              ? c().setParagraph().run()
              : c()
                  .toggleHeading({ level: Number(e.target.value[1]) })
                  .run()
          }
          aria-label="Text style"
        >
          <option value="p">Normal</option>
          <option value="h2">Large</option>
          <option value="h3">Medium</option>
        </select>
        <span className="rte-sep" />
        <T
          on={() => c().toggleBold().run()}
          act={editor.isActive("bold")}
          title="Bold (Ctrl+B)"
        >
          <Bold size={15} />
        </T>
        <T
          on={() => c().toggleItalic().run()}
          act={editor.isActive("italic")}
          title="Italic (Ctrl+I)"
        >
          <Italic size={15} />
        </T>
        <T
          on={() => c().toggleUnderline().run()}
          act={editor.isActive("underline")}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon size={15} />
        </T>
        <T
          on={() => c().toggleStrike().run()}
          act={editor.isActive("strike")}
          title="Strikethrough"
        >
          <Strikethrough size={15} />
        </T>
        <label className="rte-btn rte-color" title="Text colour">
          <span
            style={{
              borderBottom: `3px solid ${editor.getAttributes("textStyle").color || "currentColor"}`,
            }}
          >
            A
          </span>
          <input
            type="color"
            onChange={(e) => c().setColor(e.target.value).run()}
          />
        </label>
        <T
          on={() =>
            editor.isActive("highlight")
              ? c().unsetHighlight().run()
              : c().setHighlight({ color: "#fff3a3" }).run()
          }
          act={editor.isActive("highlight")}
          title="Highlight"
        >
          <Highlighter size={15} />
        </T>
        <span className="rte-sep" />
        <T
          on={() => c().setTextAlign("left").run()}
          act={editor.isActive({ textAlign: "left" })}
          title="Align left"
        >
          <AlignLeft size={15} />
        </T>
        <T
          on={() => c().setTextAlign("center").run()}
          act={editor.isActive({ textAlign: "center" })}
          title="Align centre"
        >
          <AlignCenter size={15} />
        </T>
        <T
          on={() => c().setTextAlign("right").run()}
          act={editor.isActive({ textAlign: "right" })}
          title="Align right"
        >
          <AlignRight size={15} />
        </T>
        <span className="rte-sep" />
        <T
          on={() => c().toggleBulletList().run()}
          act={editor.isActive("bulletList")}
          title="Bulleted list"
        >
          <List size={15} />
        </T>
        <T
          on={() => c().toggleOrderedList().run()}
          act={editor.isActive("orderedList")}
          title="Numbered list"
        >
          <ListOrdered size={15} />
        </T>
        <T
          on={() => c().toggleBlockquote().run()}
          act={editor.isActive("blockquote")}
          title="Quote"
        >
          <Quote size={15} />
        </T>
        <T on={setLink} act={editor.isActive("link")} title="Insert link">
          <Link2 size={15} />
        </T>
        <T
          on={() => c().unsetAllMarks().clearNodes().run()}
          title="Clear formatting"
        >
          <RemoveFormatting size={15} />
        </T>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
