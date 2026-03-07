import { Millennium, definePlugin, callable, IconsModule, Field, DialogButton, TextField } from '@steambrew/client';
import React from 'react';

const getGameConfig = callable<[{ app_id: string }], any>('get_game_config');
const getAchievements = callable<[{ app_id: string }], any>('get_achievements');
const saveGameConfig = callable<[{ app_id: string; interface_path: string; status_path: string }], any>('save_game_config');

const log = (...args: any[]) => console.log("[GSE]", ...args);

let lastAppId: string | null = null;

const getAppId = async (doc: Document): Promise<string | null> => {
    const win = (doc.defaultView || window) as any;
    const gWin = window as any;
    const manager = gWin.MainWindowBrowserManager || win.MainWindowBrowserManager;
    if (manager?.m_lastLocation?.pathname) {
        const match = manager.m_lastLocation.pathname.match(/\/app\/(\d+)/);
        if (match) return match[1];
    }
    const match = win.location.href.match(/\/app\/(\d+)/) || win.location.href.match(/appid=(\d+)/);
    if (match) return match[1];
    return null;
};

const getGameName = (appId: string) => {
    try {
        const overview = (window as any).appStore?.GetAppOverviewByAppID(parseInt(appId));
        return overview?.display_name || `App ${appId}`;
    } catch (e) {
        return `App ${appId}`;
    }
};

const GSEGameSettings = ({ appId }: { appId: string }) => {
    const [interfacePath, setInterfacePath] = React.useState('');
    const [statusPath, setStatusPath] = React.useState('');
    const [achievements, setAchievements] = React.useState<any[]>([]);
    const gameName = getGameName(appId);

    React.useEffect(() => {
        const load = async () => {
            const config = await getGameConfig({ app_id: appId });
            setInterfacePath(config.interface_path || '');
            setStatusPath(config.status_path || '');
            const data = await getAchievements({ app_id: appId });
            setAchievements(data || []);
        };
        load();
    }, [appId]);

    const handleSave = async () => {
        const res = await saveGameConfig({ 
            app_id: appId, 
            interface_path: interfacePath.replace(/\\/g, '/').replace(/"/g, '').trim(), 
            status_path: statusPath.replace(/\\/g, '/').replace(/"/g, '').trim() 
        });
        if (res?.success) alert("✅ Saved!");
    };

    return (
        <div style={{ padding: '20px', color: 'white', backgroundColor: '#1b2838' }}>
            <h3 style={{ marginBottom: '15px' }}>{gameName}</h3>
            <Field label="Interface Path"><TextField value={interfacePath} onChange={(e:any)=>setInterfacePath(e.target.value)} /></Field>
            <Field label="Status Path"><TextField value={statusPath} onChange={(e:any)=>setStatusPath(e.target.value)} /></Field>
            <DialogButton onClick={handleSave} style={{ width: '100%', marginTop: '10px' }}>Save Settings</DialogButton>
            {achievements.length > 0 && (
                <div style={{ marginTop: '15px', maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '10px' }}>
                    {achievements.map(a => (<div key={a.name} style={{ fontSize: '11px', color: a.unlocked ? '#4caf50' : '#666' }}>{a.unlocked ? '✅' : '🔒'} {a.display_name || a.name}</div>))}
                </div>
            )}
        </div>
    );
};

const showGSEConfig = (appId: string, doc: Document) => {
    log("Opening modal for:", appId);
    const win = (doc.defaultView || window) as any;
    const rd = win.ReactDOM || (window as any).ReactDOM;
    if (!rd) return log("ReactDOM not found in window context");

    const modalRoot = doc.createElement('div');
    doc.body.appendChild(modalRoot);
    
    const onClose = () => {
        if (rd.unmountComponentAtNode) rd.unmountComponentAtNode(modalRoot);
        modalRoot.remove();
    };

    const element = (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
            <div style={{ width: '500px', background: '#1e2127', borderRadius: '4px' }} onClick={e => e.stopPropagation()}>
                <GSEGameSettings appId={appId} />
                <div style={{ padding: '10px', textAlign: 'right' }}><DialogButton onClick={onClose}>Close</DialogButton></div>
            </div>
        </div>
    );

    if (rd.createRoot) {
        if (!(modalRoot as any)._root) (modalRoot as any)._root = rd.createRoot(modalRoot);
        (modalRoot as any)._root.render(element);
    } else {
        rd.render(element, modalRoot);
    }
};

const processInjection = async (doc: Document) => {
    const appId = await getAppId(doc);
    if (!appId) return;

    if (appId !== lastAppId) {
        log("Game Page:", appId);
        lastAppId = appId;
    }

    // Link Bar Button
    const linksBar = doc.querySelector('.DgVQapkBmhAW6oPY5rPZo');
    if (linksBar && !linksBar.querySelector('.gse-details-button')) {
        const lastItem = linksBar.lastElementChild as HTMLElement;
        const nextLeft = lastItem ? parseInt(lastItem.style.left || '0') + (lastItem.offsetWidth || 100) + 8 : 0;
        
        const btn = doc.createElement('div');
        btn.className = '_7k4qmaN8SUMvv6u-L81uk gse-details-button';
        btn.style.cssText = `left: ${nextLeft}px; top: 0px; position: absolute;`;
        btn.innerHTML = `<div role="link" class="DY4_wSF8h9T5o46hO5I9V Panel" tabindex="0"><div class="_1b6LYWVijW-9E4YV0keDWZ"><span class="_2sNDjgK9EWiPLdNGkjun-w">GSE Achievements</span></div></div>`;
        
        const clickable = btn.querySelector('.DY4_wSF8h9T5o46hO5I9V');
        if (clickable) {
            clickable.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                log("Button Clicked!");
                showGSEConfig(appId, doc);
            });
        }
        linksBar.appendChild(btn);
    }

    // General Properties
    const generalTarget = Array.from(doc.querySelectorAll('*')).find((el: any) => 
        (el.innerText === 'Launch Options' || el.innerText === 'LAUNCH OPTIONS' || el.innerText === 'Steam Cloud') && el.offsetWidth > 0
    );
    if (generalTarget && !doc.querySelector('.gse-general-injected')) {
        const target = generalTarget.closest('[class*="Section"]') || generalTarget.parentElement;
        const win = (doc.defaultView || window) as any;
        const rd = win.ReactDOM || (window as any).ReactDOM;
        if (target && rd) {
            const injectDiv = doc.createElement('div');
            injectDiv.className = 'gse-general-injected';
            injectDiv.style.cssText = 'margin: 20px 0; padding: 15px; background: rgba(0,0,0,0.3); border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);';
            target.parentElement?.insertBefore(injectDiv, target);
            if (rd.createRoot) {
                if (!(injectDiv as any)._root) (injectDiv as any)._root = rd.createRoot(injectDiv);
                (injectDiv as any)._root.render(<GSEGameSettings appId={appId} />);
            } else {
                rd.render(<GSEGameSettings appId={appId} />, injectDiv);
            }
        }
    }
};

export default definePlugin(() => {
    (Millennium as any).AddWindowCreateHook?.((context: any) => {
        if (!context.m_strName?.startsWith("SP ")) return;
        const doc = context.m_popup?.document;
        if (!doc?.body) return;
        const observer = new MutationObserver(() => processInjection(doc));
        observer.observe(doc.body, { childList: true, subtree: true });
        processInjection(doc);
    });
    return {
        title: "GSE Achievements",
        icon: <IconsModule.Settings />,
        content: <div style={{padding: '20px'}}>GSE Active.</div>,
    };
});
