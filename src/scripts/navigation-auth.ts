import { getAuthClient } from '../lib/supabase-client';

const guestLinks=document.querySelectorAll<HTMLElement>('[data-nav-guest]');
const memberLink=document.querySelector<HTMLElement>('[data-nav-member]');
const update=(signedIn:boolean)=>{
  guestLinks.forEach(link=>link.hidden=signedIn);
  if(memberLink) memberLink.hidden=!signedIn;
};
const client=getAuthClient();
if(client) {
  // INITIAL_SESSION and subsequent cross-tab changes arrive through the same callback.
  // Keep the callback synchronous so it never waits on the auth lock.
  client.auth.onAuthStateChange((_event,session)=>update(Boolean(session?.user)));
}
