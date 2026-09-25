-- Initial Seoul editorial events for October 2026.
-- Review organizer availability and meeting points before publishing this seed.
-- Run once using the authorized Supabase SQL Editor role, not a client session.
-- Fixed event UUIDs link the public and private rows deterministically.
-- A duplicate UUID fails the transaction; no existing rows are overwritten.
-- Existing triggers generate created_at, updated_at, and published_at.
begin;

insert into public.events (
  id, title, description, public_area, category, starts_at,
  application_deadline, participation_info, cancellation_policy, status
)
values
(
  'd351b438-2a73-4b96-9be7-40930ac98a61',
  'Seongsu Social Walk',
  'Explore Seongsu at an easy pace with fellow international visitors and Korea enthusiasts. This two-hour neighborhood walk combines conversation, small streets, and time to notice the creative spaces that give the area its character. An optional cafe stop offers a chance to continue chatting; individual purchases are not included.',
  'Seongsu-dong, Seongdong-gu, Seoul',
  'Neighborhood walk',
  '2026-10-10 14:00:00+09:00'::timestamptz,
  '2026-10-08 18:00:00+09:00'::timestamptz,
  'Plan for approximately two hours on foot. Wear comfortable shoes and bring water and a light layer. Conversation will be primarily in English, with Korean welcome. Please ask before photographing other participants or entering shops as a group. Apply only if you expect to attend; exact arrival instructions are available after approval.',
  'Please aim to resolve any change of plans at least 24 hours before the start. If organizer contact information is provided separately, use it to communicate a cancellation. There is no automated cancellation or refund process. Arrive on time: the walk may depart without late arrivals. Check this event page before travelling in poor weather.',
  'published'
),
(
  '0ce72d96-34a8-4b15-827c-69e83ac045f2',
  'Han River Evening Picnic',
  'Spend a relaxed early evening by the Han River, sharing travel stories and getting to know other members of the community. Bring your own picnic food and settle in for a low-key outdoor gathering of around two hours. This is a social meetup rather than a catered event, and everyone is responsible for their own food and belongings.',
  'Yeouido riverside area, Yeongdeungpo-gu, Seoul',
  'Outdoor social meetup',
  '2026-10-11 17:00:00+09:00'::timestamptz,
  '2026-10-09 18:00:00+09:00'::timestamptz,
  'Bring a picnic mat if you have one, drinking water, your own food, and a warm layer for the evening. Keep shared food clearly labelled for allergens and do not assume refreshments will be provided. Stay away from the water edge, keep paths clear, and take all rubbish with you. Exact meeting instructions are shared only with approved participants.',
  'Please plan any cancellation at least 24 hours in advance and inform the organizer through any contact method provided separately. Repeated no-shows make small community gatherings difficult to plan. Outdoor arrangements may change in rain or strong wind; check this event page before leaving. No automatic cancellation or refund service is offered.',
  'published'
),
(
  '852c67ab-a531-4de2-a046-187b92c53f70',
  'Mangwon Market Food Meetup',
  'Discover Mangwon through an informal market visit with other curious travellers. Over roughly two hours, browse food stalls, compare favourite finds, and learn from each other while exploring the surrounding neighborhood. Choose and pay for your own food so you can follow your budget and preferences; this meetup does not include a tasting package.',
  'Mangwon-dong, Mapo-gu, Seoul',
  'Market and food meetup',
  '2026-10-17 11:00:00+09:00'::timestamptz,
  '2026-10-15 18:00:00+09:00'::timestamptz,
  'Bring a payment method suitable for small purchases, water, and comfortable shoes. Dietary needs and food allergies are your responsibility: ask vendors about ingredients before buying, as the group cannot guarantee allergen-free options. Keep shop entrances clear, follow vendor guidance, and ask permission before taking photographs. Exact meeting details are available after approval.',
  'Please communicate a cancellation at least 24 hours before the meetup through any organizer contact method provided separately. Be punctual so the group can enter the market together; late arrivals may not be able to locate the moving group. Individual food purchases are separate from the meetup and subject to vendor terms. There is no automated cancellation process.',
  'published'
),
(
  'ac7f24d8-691e-45b3-b98c-25d76480fe13',
  'Seochon Culture Walk',
  'Take a gentle walk through Seochon and enjoy conversation about everyday culture, neighborhood streets, and visiting Korea thoughtfully. Allow around two hours for an unhurried route with short observation stops and time to exchange recommendations. This community walk is not a professional guided tour and does not include paid attraction entry.',
  'Seochon, Jongno-gu, Seoul',
  'Culture walk',
  '2026-10-18 14:00:00+09:00'::timestamptz,
  '2026-10-16 18:00:00+09:00'::timestamptz,
  'Wear comfortable walking shoes and bring water and weather-appropriate clothing. Expect narrow streets and occasional uneven surfaces. Keep conversation considerate near homes, do not enter private courtyards, and ask before photographing people. English will be the main shared language. Approved participants can view exact arrival instructions in My Events.',
  'Please make changes to your attendance plans at least 24 hours before the start and notify the organizer using any contact details supplied separately. Arrive on time; the group may leave the starting point promptly. Check the event page for weather-related changes before travelling. This MVP does not provide automated cancellations or refunds.',
  'published'
);

-- Private arrival information belongs ONLY in this protected table.
-- No participant identities, personal contact information, or applications.
insert into public.event_meeting_details (event_id, meeting_details)
values
(
  'd351b438-2a73-4b96-9be7-40930ac98a61',
  'Meet at street level outside Seongsu Station Exit 3 at 13:50 on October 10. Wait to the side of the exit, leaving the stairs, tactile paving, and pedestrian route clear. Look for a small Korean Wave Community sign and check in with the organizer before the walk begins at 14:00. Do not wait inside a shop or block its entrance.'
),
(
  '0ce72d96-34a8-4b15-827c-69e83ac045f2',
  'Meet at street level outside Yeouinaru Station Exit 2 at 16:50 on October 11. Stand to the side on the public pavement rather than on the stairs or cycle route. Look for the organizer holding a Korean Wave Community sign. The group will walk to a picnic spot together at 17:00; do not set up beside the station exit.'
),
(
  '852c67ab-a531-4de2-a046-187b92c53f70',
  'Meet at street level outside Mangwon Station Exit 2 at 10:50 on October 17. Gather beside the exit without obstructing pedestrian access or nearby businesses. Look for a Korean Wave Community sign and check in with the organizer. At 11:00 the group will leave together for the market; please do not wait at an individual food stall.'
),
(
  'ac7f24d8-691e-45b3-b98c-25d76480fe13',
  'Meet at street level outside Gyeongbokgung Station Exit 2 at 13:50 on October 18. Wait to one side of the exit on public pavement, keeping the stairs and tactile paving clear. Look for a Korean Wave Community sign and check in with the organizer. The walk starts at 14:00; do not gather inside nearby residential lanes.'
);

commit;
