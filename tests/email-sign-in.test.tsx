// @vitest-environment jsdom
import {cleanup,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {EmailSignIn} from '../src/components/watch/EmailSignIn';
import {emailAuthEntry} from '../src/watch/email-auth-entry';

afterEach(()=>{cleanup();vi.restoreAllMocks();});

function mockFetch(status:number,body:unknown){
 const fetch=vi.fn(async()=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}}));
 vi.stubGlobal('fetch',fetch);
 return fetch;
}

it('reads verification and reset redirects without trusting a reset error as a token',()=>{
 expect(emailAuthEntry('/watch','?verified=1')).toMatchObject({mode:'sign-in',notice:expect.stringContaining('Email verified')});
 expect(emailAuthEntry('/watch/reset-password','?token=abc')).toEqual({mode:'reset',token:'abc',notice:''});
 expect(emailAuthEntry('/watch/reset-password/','?token=abc&error=INVALID_TOKEN')).toMatchObject({mode:'forgot',token:''});
 expect(emailAuthEntry('/watch/reset-password','')).toMatchObject({mode:'forgot',notice:expect.stringContaining('expired')});
});

it('signs in as JSON and follows only a same-site redirect',async()=>{
 const user=userEvent.setup();
 const fetch=mockFetch(200,{ok:true,redirect:'/watch'});
 const assign=vi.fn();
 vi.stubGlobal('location',{...window.location,assign});
 render(<EmailSignIn path="/watch" search=""/>);
 await user.type(screen.getByLabelText('Email'),'ada@example.com');
 await user.type(screen.getByLabelText('Password'),'analytical');
 await user.click(screen.getByRole('button',{name:'Sign in'}));
 expect(fetch).toHaveBeenCalledWith('/api/auth/email/sign-in',expect.objectContaining({
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'ada@example.com',password:'analytical'}),
 }));
 expect(assign).toHaveBeenCalledWith('/watch');
 vi.unstubAllGlobals();
});

it('shows the server error as an alert and keeps the person on the form',async()=>{
 const user=userEvent.setup();
 mockFetch(401,{error:'That email and password do not match an account.'});
 render(<EmailSignIn path="/watch" search=""/>);
 await user.type(screen.getByLabelText('Email'),'ada@example.com');
 await user.type(screen.getByLabelText('Password'),'wrong-guess');
 await user.click(screen.getByRole('button',{name:'Sign in'}));
 expect((await screen.findByRole('alert')).textContent).toBe('That email and password do not match an account.');
 expect(screen.getByRole('button',{name:'Sign in'})).toBeTruthy();
 vi.unstubAllGlobals();
});

it('asks a new account to verify its email before signing in',async()=>{
 const user=userEvent.setup();
 const fetch=mockFetch(202,{status:'verify_email'});
 render(<EmailSignIn path="/watch" search=""/>);
 await user.click(screen.getByRole('button',{name:'Create an account'}));
 await user.type(screen.getByLabelText('Name'),'Ada');
 await user.type(screen.getByLabelText('Email'),'ada@example.com');
 const password=screen.getByLabelText('New password');
 expect(password.getAttribute('autocomplete')).toBe('new-password');
 expect(password.getAttribute('minlength')).toBe('8');
 await user.type(password,'analytical');
 await user.click(screen.getByRole('button',{name:'Create account'}));
 expect(fetch).toHaveBeenCalledWith('/api/auth/email/sign-up',expect.anything());
 expect((await screen.findByRole('status')).textContent).toContain('ada@example.com');
 await user.click(screen.getByRole('button',{name:'Back to sign in'}));
 expect(screen.getByRole('heading',{name:'Sign in with email'})).toBeTruthy();
 vi.unstubAllGlobals();
});

it('requests a reset without revealing whether the account exists',async()=>{
 const user=userEvent.setup();
 mockFetch(202,{status:'sent'});
 render(<EmailSignIn path="/watch" search=""/>);
 await user.click(screen.getByRole('button',{name:'Forgot password?'}));
 expect(screen.queryByLabelText('Password')).toBeNull();
 await user.type(screen.getByLabelText('Email'),'nobody@example.com');
 await user.click(screen.getByRole('button',{name:'Send reset link'}));
 expect((await screen.findByRole('status')).textContent).toBe('If an account uses nobody@example.com, a password reset link is on its way.');
 vi.unstubAllGlobals();
});

it('resets the password with the link token and clears it from the address bar',async()=>{
 const user=userEvent.setup();
 const fetch=mockFetch(200,{status:'reset'});
 const replace=vi.spyOn(window.history,'replaceState');
 render(<EmailSignIn path="/watch/reset-password" search="?token=reset-token"/>);
 expect(screen.queryByLabelText('Email')).toBeNull();
 await user.type(screen.getByLabelText('New password'),'brand-new-pass');
 await user.click(screen.getByRole('button',{name:'Update password'}));
 expect(fetch).toHaveBeenCalledWith('/api/auth/email/reset-password',expect.objectContaining({body:JSON.stringify({token:'reset-token',password:'brand-new-pass'})}));
 expect(replace).toHaveBeenCalledWith({},'','/watch');
 expect((await screen.findByRole('heading',{name:'Password updated'}))).toBeTruthy();
 vi.unstubAllGlobals();
});
