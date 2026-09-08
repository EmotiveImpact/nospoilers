// @vitest-environment jsdom
import {render,screen,cleanup} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import App from '../src/App.tsx';

vi.mock('../src/pages/DocsPage.tsx',()=>({DocsPage:({path}:{path:string})=><main>Docs route: {path}</main>}));
vi.mock('../src/components/SiteChrome.tsx',()=>({SiteChrome:({children}:{children:React.ReactNode})=><div data-testid="marketing-shell">{children}</div>}));
afterEach(()=>{cleanup();window.history.replaceState({},'', '/');});
it.each(['/docs','/docs/getting-started'])('keeps %s outside the marketing shell',path=>{
 window.history.replaceState({},'',path);
 render(<App/>);
 expect(screen.getByRole('main').textContent).toBe(`Docs route: ${path}`);
 expect(screen.queryByTestId('marketing-shell')).toBeNull();
});
