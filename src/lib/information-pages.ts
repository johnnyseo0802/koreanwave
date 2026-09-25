export const informationPages = {
  about: {
    title: "About Korean Wave Community", intro: "Korean culture, real local Korea, and people who want to explore both.",
    sections: [
      ["Beyond the screen", "Discover music, dramas, movies, beauty, fashion, and food alongside places, experiences, and community gatherings in Korea."],
      ["Built around useful contributions", "Ask a Local, answers, and place reviews are reviewed before publication. Moderation helps keep discussions useful; it is not a guarantee that every statement is accurate."],
      ["An early community", "This is an MVP. There are no direct messages, public member directories, social login, or payments. Your profile is private. Start with a question, a review, or an event application."],
    ],
  },
  safety: {
    title: "Safety & community guidelines", intro: "Be curious, be considerate, and protect each other’s privacy.",
    sections: [
      ["Keep contributions welcoming", "No harassment, hate, threats, impersonation, spam, or deceptive promotions. Share first-hand experiences where possible and distinguish opinions from facts. Publish only text and images you have permission to share."],
      ["Protect private information", "Do not post email addresses, phone numbers, identity documents, another person’s details, or private meeting instructions. Approved event participants should keep meeting details within their participation context."],
      ["Meet thoughtfully", "Read the event information, plan your own transport, and meet in public spaces. Respect personal boundaries and ask before taking photos. Participation approval is not an identity check or safety guarantee."],
      ["Moderation and urgent concerns", "Questions, answers, and reviews appear only after approval. This site is not an emergency service. For immediate danger, contact local emergency services. Use the Contact page for the current support status."],
    ],
  },
  faq: {
    title: "Frequently asked questions", intro: "A short guide to using the community.",
    sections: [
      ["Do I need an account?", "You can read published content without logging in. Sign in to contribute, apply to events, or manage your private profile."],
      ["Why is my contribution not visible?", "New questions, answers, and reviews are pending until an administrator approves them. Submission does not guarantee publication or a review time. A personal submissions list is not available yet."],
      ["Where are my event details?", "Open My Account → My Events to see your application status. Exact meeting instructions become available there only after approval and while the event remains published."],
      ["How do I confirm my email?", "After signing up, open the confirmation link in your email. If the link fails or has expired, return to the login page and review the confirmation guidance. Password recovery and social login are not available in this MVP."],
      ["Can I cancel or pay on the site?", "There are no payments or self-service cancellations. Read the event-specific participation and cancellation information before applying."],
    ],
  },
  contact: {
    title: "Contact", intro: "Support availability for the early Korean Wave Community MVP.",
    sections: [
      ["Support channel not yet published", "A verified operator contact address has not been configured. This page does not accept messages and no response time is promised. A working contact channel must be published before the public launch."],
      ["Account and privacy requests", "Account deletion, data requests, and abuse reports do not yet have a self-service workflow. The operator must provide a contact and handling process before general public use. Do not post private account details in Ask a Local."],
      ["Event questions", "Use only organizer contact instructions actually provided for your event. Do not assume a contact form, cancellation tool, or organizer message system exists."],
    ],
  },
  privacy: {
    title: "Privacy — MVP notice", intro: "A plain-language description of the current implementation, pending operator review before public launch.",
    sections: [
      ["Information used by the service", "Supabase Auth handles account authentication. The service stores private profile fields you provide, community submissions, and event applications. Published contributions are visible publicly; current public content pages do not display member emails or author IDs."],
      ["Access and session storage", "Authentication uses session cookies and the Supabase SDK. Administrators review submissions and event applications. Exact event meeting details are restricted to approved applicants. External editorial images are loaded from their hosting sites, which receive the browser request."],
      ["Before public launch", "The operator must confirm its identity and contact details, service providers and hosting locations, retention/deletion practices, and the process for privacy requests. This interim notice is not a claim of compliance and does not replace a reviewed privacy policy."],
    ],
  },
  terms: {
    title: "Terms — MVP operating notice", intro: "Current service boundaries. The operator must review and finalize terms before a public launch.",
    sections: [
      ["Using the community", "Use an account you control. Follow the safety guidelines and contribute only content you have permission to share. Keep private information out of public submissions."],
      ["Content and participation", "Community contributions are moderated and may not be published. Editorial and member content can become outdated; verify important travel arrangements directly. Event applications require approval and do not guarantee availability or safety."],
      ["MVP limitations", "The platform does not process payments, provide direct messaging, or offer automatic refunds or cancellations. Final terms must identify the operator and address applicable user rights, responsibilities, and dispute processes. No legal guarantees are made by this draft."],
    ],
  },
  cancellation: {
    title: "Cancellations & attendance", intro: "Check the policy of the specific event before applying.",
    sections: [
      ["Before you apply", "Review the date, application deadline, participation information, and event-specific cancellation guidance. Dates and times are displayed in Korea Standard Time (KST)."],
      ["If your plans change", "There is no self-service cancellation or withdrawal button in the MVP. Follow any organizer contact instructions actually provided. If none are provided, the platform currently has no in-app cancellation channel."],
      ["No platform payments", "The site does not take payments or issue refunds. Purchases made separately with shops, venues, or other providers are outside the application workflow. Do not assume an event application includes transport, meals, insurance, or paid entry."],
      ["Attend considerately", "Arrive on time, respect the organizer’s guidance, and check for changes before travelling. The operator must establish a reliable cancellation/support process before public event operations."],
    ],
  },
} as const;
export type InformationPageKey = keyof typeof informationPages;
