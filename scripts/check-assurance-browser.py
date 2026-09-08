"""Optional fixture-only browser acceptance for the actual native DOM renderer.
Requires Python Playwright and Chromium. It does not prove React routing or live APIs.
Usage: python scripts/check-assurance-browser.py .assurance-review
"""
import json
import os
from pathlib import Path
import shutil
import sys
from playwright.sync_api import sync_playwright

root = Path(sys.argv[1]).resolve()
views = json.loads((root / 'views.json').read_text())
bundle = (root / 'renderer.js').read_text()
css = (root / 'panel.css').read_text()
results = []
errors = []

def check(name, condition):
    results.append({'name': name, 'passed': bool(condition)})
    if not condition:
        raise AssertionError(name)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'), headless=True, args=['--no-sandbox'])
    page = browser.new_page(accept_downloads=True)
    page.on('pageerror', lambda error: errors.append(str(error)))
    def mount(view):
        page.set_content('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:16px;background:#09090b;color:#f4f4f5;font:16px Arial,sans-serif"><main style="max-width:1100px;margin:auto"><h1>Release assurance: synthetic review fixture</h1><div id="root"></div><h2 id="evidence" tabindex="-1">Original evidence</h2></main></body></html>')
        page.add_style_tag(content=css)
        page.add_script_tag(content=bundle)
        page.evaluate('''view=>{
          window.calls={review:0,refresh:0,exported:0};window.view=view;
          window.original=JSON.stringify(view);
          window.clean=assuranceRenderer.renderAssurancePanel(document.getElementById('root'),view,{
            review:()=>{window.calls.review++;document.getElementById('evidence').focus();},
            refresh:()=>{window.calls.refresh++;},
            exportPassport:()=>{window.calls.exported++;assuranceClient.downloadPassport(view.passport,view.assessment.releaseId);}
          });
        }''', view)
    for width in [390,768,1440]:
        page.set_viewport_size({'width':width,'height':1000})
        for state, view in views.items():
            mount(view)
            check(f'{state} at {width}: no horizontal overflow', page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
            check(f'{state} at {width}: only one primary action', page.locator('.ns-assurance__primary').count()==1)
            check(f'{state} at {width}: separate delivery state', page.get_by_text('Published delivery',exact=True).count()==1)
    page.set_viewport_size({'width':1440,'height':1000})
    mount(views['review'])
    check('Current transport response accepted',page.evaluate('assuranceClient.readAssuranceView(window.view,2)!==null'))
    check('Foreign record rejected',page.evaluate('assuranceClient.readAssuranceView(window.view,99)===null'))
    check('Incomplete comparison rejected',page.evaluate('assuranceClient.readAssuranceView({...window.view,comparison:{available:true}},2)===null'))
    check('Invalid timestamp rejected',page.evaluate('assuranceClient.readAssuranceView({...window.view,assessment:{...window.view.assessment,evaluatedAt:"garbage"}},2)===null'))
    page.get_by_text('Inspect recorded file changes',exact=True).click()
    check('Hostile filename remains text',page.locator('.ns-assurance__comparison img').count()==0 and page.evaluate('window.injected!==true'))
    page.get_by_text('Preview a stricter review',exact=True).focus()
    page.keyboard.press('Enter')
    check('Disclosure opens with keyboard',page.locator('details').filter(has=page.get_by_text('Preview a stricter review',exact=True)).get_attribute('open') is not None)
    toggle=page.get_by_role('checkbox')
    toggle.focus();page.keyboard.press('Space')
    check('Preview tightens warning without saving', 'Recorded checks block release' in page.locator('.ns-assurance__decision').inner_text())
    check('Preview retains keyboard focus',toggle.evaluate('(node)=>node===document.activeElement'))
    check('Preview announces scope', 'No policy was saved' in page.get_by_role('status').inner_text())
    check('Preview leaves source immutable',page.evaluate('JSON.stringify(window.view)===window.original'))
    page.keyboard.press('Space')
    check('Original review restored', 'Review recorded findings' in page.locator('.ns-assurance__decision').inner_text())
    page.locator('.ns-assurance__primary').click()
    check('Primary action routes to original evidence',page.evaluate('window.calls.review===1&&document.activeElement.id==="evidence"'))
    page.get_by_role('button',name='Refresh saved snapshot').click()
    check('Refresh callback only',page.evaluate('window.calls.refresh===1'))
    with page.expect_download() as event:
        page.get_by_role('button',name='Export private passport').click()
    downloaded=event.value
    data=json.loads(Path(downloaded.path()).read_text())
    check('Real passport download',downloaded.suggested_filename=='nospoilers-release-passport-2.json')
    check('Passport explicitly unsigned',data['signatureStatus']=='unsigned-summary' and data['certification'] is False)
    check('Passport omits path evidence','<img' not in json.dumps(data) and 'findingFingerprints' not in json.dumps(data))
    page.emulate_media(reduced_motion='reduce')
    check('Reduced motion disables transitions',page.locator('.ns-assurance__primary').evaluate('(node)=>getComputedStyle(node).transitionDuration')=='0s')
    page.evaluate('window.clean()')
    check('Unmount removes panel',page.locator('#root').inner_text()=='')
    check('No browser errors',not errors)
    mount(views['ready'])
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':900})
    mount(views['review'])
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    browser.close()
(root/'browser-results.json').write_text(json.dumps({'scope':'Actual native renderer with synthetic evidence, not full React/API integration','passed':sum(r['passed'] for r in results),'failed':sum(not r['passed'] for r in results),'errors':errors,'checks':results},indent=2))
print(f'{len(results)} browser checks passed')
