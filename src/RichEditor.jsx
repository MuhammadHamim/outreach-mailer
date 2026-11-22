import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import "@fontsource/roboto/latin-400.css";
import "@fontsource/roboto/latin-700.css";
import "@fontsource/roboto/latin-400-italic.css";
import "@fontsource/open-sans/latin-400.css";
import "@fontsource/open-sans/latin-700.css";
import "@fontsource/open-sans/latin-400-italic.css";
import "@fontsource/lato/latin-400.css";
import "@fontsource/lato/latin-700.css";
import "@fontsource/lato/latin-400-italic.css";
import "@fontsource/montserrat/latin-400.css";
import "@fontsource/montserrat/latin-700.css";
import "@fontsource/montserrat/latin-400-italic.css";
import "@fontsource/source-sans-3/latin-400.css";
import "@fontsource/source-sans-3/latin-700.css";
import "@fontsource/source-sans-3/latin-400-italic.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/inter/latin-400-italic.css";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-700.css";
import "@fontsource/poppins/latin-400-italic.css";
import "@fontsource/merriweather/latin-400.css";
import "@fontsource/merriweather/latin-700.css";
import "@fontsource/merriweather/latin-400-italic.css";
import "@fontsource/playfair-display/latin-400.css";
import "@fontsource/playfair-display/latin-700.css";
import "@fontsource/playfair-display/latin-400-italic.css";
import "@fontsource/lora/latin-400.css";
import "@fontsource/lora/latin-700.css";
import "@fontsource/lora/latin-400-italic.css";
import "@fontsource/eb-garamond/latin-400.css";
import "@fontsource/eb-garamond/latin-700.css";
import "@fontsource/eb-garamond/latin-400-italic.css";
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

const FONTS = [
  ["", "Default"],
  ["Arial,Helvetica,sans-serif", "Arial"],
  ["Georgia,'Times New Roman',serif", "Georgia"],
  ["Calibri,'Segoe UI',Arial,sans-serif", "Calibri"],
  ["'Times New Roman',Times,serif", "Times New Roman"],
  ["Garamond,'Palatino Linotype',Georgia,serif", "Garamond"],
  ["Roboto,'Microsoft YaHei','PingFang SC',sans-serif", "Roboto"],
  ["'Open Sans','Microsoft YaHei','PingFang SC',sans-serif", "Open Sans"],
  ["Lato,'Microsoft YaHei','PingFang SC',sans-serif", "Lato"],
  ["Montserrat,'Microsoft YaHei','PingFang SC',sans-serif", "Montserrat"],
  ["'Source Sans 3','Microsoft YaHei','PingFang SC',sans-serif", "Source Sans 3"],
  ["Inter,'Microsoft YaHei','PingFang SC',sans-serif", "Inter"],
  ["Poppins,'Microsoft YaHei','PingFang SC',sans-serif", "Poppins"],
  ["Merriweather,Georgia,serif", "Merriweather"],
  ["'Playfair Display',Georgia,serif", "Playfair Display"],
  ["Lora,Georgia,serif", "Lora"],
  ["'EB Garamond',Garamond,Georgia,serif", "EB Garamond"],
];

const FontStyle = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
        renderHTML: (attributes) =>
          attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
      },
      fontFamily: {
        default: null,
        parseHTML: (element) => element.style.fontFamily || null,
        renderHTML: (attributes) =>
          attributes.fontFamily ? { style: `font-family: ${attributes.fontFamily}` } : {},
      },
    };
  },
});

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
      FontStyle,
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
  const textStyle = editor.getAttributes("textStyle");
  const selectedFont = textStyle.fontFamily || "";
  const selectedSize = textStyle.fontSize
    ? textStyle.fontSize.replace(/px$/, "")
    : "14";

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
          value={selectedFont}
          onChange={(e) => {
            if (!e.target.value) {
              c().setMark("textStyle", { fontFamily: null }).run();
              return;
            }
            c().setMark("textStyle", { fontFamily: e.target.value }).run();
          }}
          aria-label="Font"
        >
          {FONTS.map(([value, label]) => (
            <option key={label} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="rte-select rte-size"
          value={selectedSize}
          onChange={(e) =>
            c().setMark("textStyle", { fontSize: `${e.target.value}px` }).run()
          }
          aria-label="Text size"
        >
          {[10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48].map((size) => (
            <option key={size} value={size}>
              {size} px
            </option>
          ))}
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
