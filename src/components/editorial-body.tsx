import { parseEditorialBody } from "@/lib/editorial-body";

export function EditorialBody({ body }: { body: string }) {
  return <div data-editorial-body className="mt-8 rounded-[2rem] border border-[#e3e7e2] bg-white px-5 py-7 sm:p-10">
    <div className="mx-auto max-w-[65ch] break-words text-base leading-7 text-[#38443c] [overflow-wrap:anywhere]">
      {parseEditorialBody(body).map((block, index) => {
        if (block.type === "heading") return <h2 key={index} className="mb-3 mt-8 text-xl font-semibold leading-snug tracking-tight text-[#18201d] first:mt-0 sm:text-2xl">{block.text}</h2>;
        if (block.type === "list") return <ul key={index} className="mb-4 list-disc space-y-1 pl-6 last:mb-0">{block.items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
        return <p key={index} className="mb-4 whitespace-pre-line last:mb-0">{block.text}</p>;
      })}
    </div>
  </div>;
}
