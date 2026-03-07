import { Millennium, definePlugin, callable, IconsModule, Field, DialogButton, TextField } from '@steambrew/client';
import React from 'react';

const getGameConfig = callable<[{ app_id: string }], any>('get_game_config');
const getAchievements = callable<[{ app_id: string }], any>('get_achievements');
const saveGameConfig = callable<[{ app_id: string; interface_path: string; status_path: string }], any>('save_game_config');

const log = (...args: any[]) => console.log("[GSE]", ...args);

let lastAppId: string | null = null;

/**
 * Robust renderer helper
 */
const renderInContainer = (element: React.ReactElement, container: HTMLElement) => {
    try {
        const win = window as any;
        const rd = win.ReactDOM || win.opener?.ReactDOM || win.parent?.ReactDOM;
        if (!rd) return;

        if (rd.createRoot) {
            if (!(container as any)._gseRoot) (container as any)._gseRoot = rd.createRoot(container);
            (container as any)._gseRoot.render(element);
        } else {
            rd.render(element, container);
        }
    } catch (e) {}
};

const getAppId = async (doc: Document): Promise<string | null> => {
    const win = (doc.defaultView || window) as any;
    const gWin = window as any;
    
    // 1. Try MainWindowBrowserManager (The most reliable for SPA navigation)
    // We check both the document's window and the global window
    const manager = gWin.MainWindowBrowserManager || win.MainWindowBrowserManager;
    if (manager?.m_lastLocation?.pathname) {
        const match = manager.m_lastLocation.pathname.match(/\/app\/(\d+)/);
        if (match) return match[1];
    }

    // 2. Try SteamClient API
    const sc = win.SteamClient || gWin.SteamClient;
    if (sc?.Apps?.GetActiveAppID) {
        try {
            const appId = await sc.Apps.GetActiveAppID();
            if (appId && appId > 0) return String(appId);
        } catch (e) {}
    }

    // 3. Fallback to image-based detection (HLTB's appIdPattern)
    const images = doc.querySelectorAll('img[src*="/assets/"]');
    for (const img of Array.from(images) as HTMLImageElement[]) {
        const match = img.src.match(/\/assets\/(\d+)/);
        if (match) return match[1];
    }
    
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
        if (res?.success) {
            const data = await getAchievements({ app_id: appId });
            setAchievements(data || []);
            alert("✅ Settings saved!");
        }
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

const showGSEConfig = (appId: string) => {
    const modalRoot = document.createElement('div');
    document.body.appendChild(modalRoot);
    const onClose = () => {
        const win = window as any;
        const rd = win.ReactDOM || win.opener?.ReactDOM || win.parent?.ReactDOM;
        if (rd?.unmountComponentAtNode) rd.unmountComponentAtNode(modalRoot);
        modalRoot.remove();
    };
    renderInContainer(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
            <div style={{ width: '500px', background: '#1e2127', borderRadius: '4px' }} onClick={e => e.stopPropagation()}>
                <GSEGameSettings appId={appId} />
                <div style={{ padding: '10px', textAlign: 'right' }}><DialogButton onClick={onClose}>Close</DialogButton></div>
            </div>
        </div>,
        modalRoot
    );
};

const processInjection = async (doc: Document) => {
    const appId = await getAppId(doc);
    if (!appId) return;

    if (appId !== lastAppId) {
        log("Found game page for appId:", appId);
        lastAppId = appId;
    }

    // 1. Links Bar
    const linksBar = doc.querySelector('.DgVQapkBmhAW6oPY5rPZo');
    if (linksBar) {
        const existing = linksBar.querySelector('.gse-details-button') as HTMLElement;
        const steamButtons = Array.from(linksBar.children).filter(c => c !== existing && (c as HTMLElement).style.left);
        const lastSteamBtn = steamButtons.sort((a,b) => parseInt((a as HTMLElement).style.left) - parseInt((b as HTMLElement).style.left)).pop() as HTMLElement;
        
        if (lastSteamBtn) {
            const nextLeft = parseInt(lastSteamBtn.style.left) + lastSteamBtn.offsetWidth + 8;
            if (!existing) {
                const btn = doc.createElement('div');
                btn.className = '_7k4qmaN8SUMvv6u-L81uk gse-details-button';
                btn.style.cssText = `left: ${nextLeft}px; top: 0px; position: absolute;`;
                btn.innerHTML = `<div role="link" class="DY4_wSF8h9T5o46hO5I9V Panel" tabindex="0"><div class="_1b6LYWVijW-9E4YV0keDWZ"><span class="_2sNDjgK9EWiPLdNGkjun-w">GSE Achievements</span></div></div>`;
                btn.onclick = () => showGSEConfig(appId);
                linksBar.appendChild(btn);
            } else {
                existing.style.left = `${nextLeft}px`;
                existing.onclick = () => showGSEConfig(appId);
            }
        }
    }

    // 2. General Properties
    const generalTarget = Array.from(doc.querySelectorAll('*')).find((el: any) => 
        (el.innerText === 'Launch Options' || el.innerText === 'LAUNCH OPTIONS' || el.innerText === 'Steam Cloud') && el.offsetWidth > 0
    );
    if (generalTarget && !doc.querySelector('.gse-general-injected')) {
        const target = generalTarget.closest('[class*="Section"]') || generalTarget.parentElement;
        if (target) {
            const injectDiv = doc.createElement('div');
            injectDiv.className = 'gse-general-injected';
            injectDiv.style.cssText = 'margin: 20px 0; padding: 15px; background: rgba(0,0,0,0.3); border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);';
            target.parentElement?.insertBefore(injectDiv, target);
            renderInContainer(<GSEGameSettings appId={appId} />, injectDiv);
        }
    }
};

export default definePlugin(() => {
    log("Plugin Entry");

    (Millennium as any).AddWindowCreateHook?.((context: any) => {
        if (!context.m_strName?.startsWith("SP ")) return;
        const doc = context.m_popup?.document;
        if (!doc?.body) return;

        log("Attached to window:", context.m_strName);

        const observer = new MutationObserver(() => processInjection(doc));
        observer.observe(doc.body, { childList: true, subtree: true });
        
        processInjection(doc);
    });

    return {
        title: "GSE Achievements",
        icon: <IconsModule.Settings />,
        content: <div style={{padding: '20px'}}>Plugin Active.</div>,
    };
});
