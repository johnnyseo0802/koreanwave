// Synthetic Next redirect envelope. Never copied from an authenticated response.
export function streamFixture(path = '/admin/community', transform = x => x) {
  const login = '/login?next=/admin/community';
  const digest = `NEXT_REDIRECT;replace;${login};307;`;
  const root = {c:path.split('/'), f:[[null, [['$','$fragment',null,{children:['$L6']}],{}]]], initialAuthenticated:false};
  const flight = transform(`0:${JSON.stringify(root)}\n6:E${JSON.stringify({digest})}\n`);
  return '<!DOCTYPE html><html><head><meta id="__next-page-redirect" http-equiv="refresh" content="1;url='+login+'"/></head><body>'
    +'<div hidden=""><!--$--><!--/$--></div><a href="#main-content" class="skip-link">Skip to content</a>'
    +'<!--$!--><template data-dgst="'+digest+'"></template>'
    +'<main id="main-content" class="mx-auto" aria-busy="true"><p role="status" class="text-sm">Loading KGROOV…</p><div aria-hidden="true" class="mt-8"></div></main><!--/$-->'
    +'<script>(self.__next_f=self.__next_f||[]).push([0])</script><script>self.__next_f.push('+JSON.stringify([1,flight])+')</script></body></html>';
}
