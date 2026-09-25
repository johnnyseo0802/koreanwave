import "server-only";
import { createClient } from "@/lib/supabase/server";
import { publicArticleFields, type EditorialSection, type PublicArticle, type ArticleCard } from "@/lib/editorial";

export async function listPublicArticles(section: EditorialSection, category?: string): Promise<ArticleCard[] | null> {
  try {
    const client = await createClient();
    let query = client.from("editorial_articles").select("id,section,category,title,summary,image_url,published_at")
      .eq("status", "published").eq("section", section);
    if (category) query = query.eq("category", category);
    const { data, error } = await query.order("published_at", { ascending: false }).order("id", { ascending: true });
    return error ? null : data as ArticleCard[];
  } catch { return null; }
}

export async function getPublicArticle(id: string): Promise<PublicArticle | null> {
  try {
    const client = await createClient();
    // Explicit filter is required even when the current session belongs to an admin.
    const { data, error } = await client.from("editorial_articles").select(publicArticleFields)
      .eq("id", id).eq("status", "published").maybeSingle();
    return error ? null : data as PublicArticle | null;
  } catch { return null; }
}
