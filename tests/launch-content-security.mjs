// Read-only local content validation. No network, accounts, imports or publishing.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base='docs/content/launch-1a-seongsu/';
const read=p=>fs.readFileSync(p,'utf8');
const json=p=>JSON.parse(read(base+p));
const pack=json('content-pack.json'),verification=json('verification.json'),images=json('images.json'),shoot=json('field-shoot.json');
assert.equal(pack.assets.length,7);assert.equal(new Set(pack.assets.map(a=>a.id)).size,7);
assert.equal(pack.mode,'human-review-only-no-import');assert.equal(pack.cluster.ready_to_publish,false);
const intents=['discovery','planning','high_intent','community','local_experience'];
for(const a of pack.assets){
 for(const key of ['title','slug','seo_title','meta_description','primary_keyword','search_intent','body'])assert.ok(typeof a[key]==='string'&&a[key].length);
 assert.ok(a.body.split(/\s+/).length>=230);assert.ok(a.meta_description.length<=180);
 assert.ok(read(base+'editorial-drafts.md').includes(a.body.replace(/^## /gm,'### ')));
 assert.ok(a.secondary_keywords.length&&a.internal_links.length&&a.primary_cta&&a.secondary_cta);
 assert.ok(intents.includes(a.traffic_intent));assert.equal(a.future_commercial_intent,'none');
 assert.equal(a.ready_to_publish,false);assert.equal(a.public_url,null);assert.equal(a.status,'local_review_draft');
 for(const m of a.body.matchAll(/C\d{2}/g))assert.ok(a.source_claim_ids.includes(m[0]),a.id);
 for(const claim of a.source_claim_ids)assert.ok(verification.records.some(r=>r.content_id===a.id&&r.claim_id===claim));
 assert.doesNotMatch(a.body,/https?:\/\/[^\s]*supabase|sb_secret_|eyJ/);
}
for(const r of verification.records){
 for(const k of ['content_id','cluster','content_type','title','claim','claim_type','source_needed','source_url','verified_at','verification_status','volatility','notes'])assert.ok(k in r,k);
 assert.ok(['unverified','verified','needs_recheck'].includes(r.verification_status));
 assert.ok(['stable','medium','high'].includes(r.volatility));
 if(r.verification_status==='verified'){assert.ok(r.source_url?.startsWith('https://'));assert.equal(r.verified_at,'2026-10-02');}
 assert.equal(r.human_publish_approved,false);
}
assert.equal(images.images.length,8);
for(const i of images.images){for(const k of ['content','purpose','aspect_ratio','preferred_source','actual_photo_required','ai_allowed','rights_status','source','credit_required','replacement_after_field_shoot','notes'])assert.ok(k in i);assert.equal(i.rights_status,'not_acquired');assert.equal(i.source,null);assert.equal(i.aspect_ratio,'16:9');if(i.actual_photo_required)assert.equal(i.ai_allowed,false);}
assert.equal(pack.prompts.length,8);for(const p of pack.prompts){assert.equal(p.editorial_only,true);assert.equal(p.no_ugc_insert,true);assert.equal(p.destination_table,'content_cluster_prompts');}
assert.equal(shoot.shots.length,66);assert.equal(shoot.footage_exists,false);assert.equal(new Set(shoot.shots.map(s=>s.group)).size,10);
for(const s of shoot.shots){for(const k of ['location_subject','framing','orientation','suggested_duration','camera_movement','video_use','website_social_reuse'])assert.ok(s[k]);assert.equal(s.status,'planned_not_captured');}
const video=read(base+'video-preproduction.md');for(const marker of ['KO:','EN:','FIELD SHOOT','LICENSED B-ROLL CANDIDATE','AI EDITORIAL VISUAL ALLOWED','MAP / MOTION GRAPHIC','Five Shorts','YouTube title options','Proposed chapters','Thumbnail copy'])assert.ok(video.includes(marker),marker);
assert.equal(pack.assets.filter(a=>a.mapping===null).length,4);
console.log('PASS: seven substantive drafts/SEO/claim coverage, verification states, eight rights-gated image plans, eight non-UGC prompts, 66 shot briefs/10 groups, bilingual video package and explicit taxonomy/publication gates. No production writes.');
