import { Millennium, definePlugin, callable, IconsModule, Field, DialogButton, TextField } from '@steambrew/client';
import React from 'react';

const getGameConfig = callable<[{ app_id: string }], any>('get_game_config');
const getAchievements = callable<[{ app_id: string }], any>('get_achievements');
const saveGameConfig = callable<[{ app_id: string; interface_path: string; status_path: string }], any>('save_game_config');

const log = (...args: any[]) => console.log("[GSE]", ...args);

let lastAppId: string | null = null;

const getReactDOM = () => {
    const win = window as any;
    return win.ReactDOM || win.opener?.ReactDOM || win.parent?.ReactDOM || (win.MainWindowBrowserManager && win.MainWindowBrowserManager.m_ReactDOM);
};

const getAppId = async (doc: Document): Promise<string | null> => {
    const win = (doc.defaultView || window) as any;
    if (win.MainWindowBrowserManager?.m_lastLocation?.pathname) {
        const match = win.MainWindowBrowserManager.m_lastLocation.pathname.match(/\/app\/(\d+)/);
        if (match) return match[1];
    }
    const match = win.location.href.match(/\/app\/(\d+)/) || win.location.href.match(/appid=(\d+)/);
    if (match) return match[1];
    const images = doc.querySelectorAll('img[src*="/assets/"]');
    for (const img of Array.from(images) as HTMLImageElement[]) {
        const imgMatch = img.src.match(/\/assets\/(\d+)/);
        if (imgMatch) return imgMatch[1];
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
            alert("✅ Settings saved for " + gameName);
        }
    };

    return (
        <div style={{ padding: '25px', color: 'white', backgroundColor: '#1b2838', borderRadius: '4px' }}>
            <h2 style={{ marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>{gameName} Configuration</h2>
            <Field label="Achievements Interface Path (Metadata)">
                <TextField value={interfacePath} onChange={(e:any)=>setInterfacePath(e.target.value)} />
            </Field>
            <Field label="Achievements Status Path (Unlocked)">
                <TextField value={statusPath} onChange={(e:any)=>setStatusPath(e.target.value)} />
            </Field>
            <DialogButton onClick={handleSave} style={{ width: '100%', marginTop: '20px' }}>Save Settings</DialogButton>
            {achievements.length > 0 && (
                <div style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '15px' }}>
                    <div style={{ marginBottom: '10px', fontSize: '14px', color: '#888' }}>{achievements.filter(a=>a.unlocked).length} / {achievements.length} Unlocked</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px', maxHeight: '200px', overflowY: 'auto', padding: '10px', background: 'rgba(0,0,0,0.2)' }}>
                        {achievements.map(a => (<div key={a.name} style={{ fontSize: '11px', color: a.unlocked ? '#4caf50' : '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.unlocked ? '✅' : '🔒'} {a.display_name || a.name}</div>))}
                    </div>
                </div>
            )}
        </div>
    );
};

const showGSEConfig = (appId: string) => {
    const modalRoot = document.createElement('div') as any;
    document.body.appendChild(modalRoot);
    
    const rd = getReactDOM();
    if (!rd) return console.error("[GSE] ReactDOM not found");

    const onClose = () => {
        if (rd.unmountComponentAtNode) rd.unmountComponentAtNode(modalRoot);
        else if (modalRoot._root) modalRoot._root.unmount();
        modalRoot.remove();
    };

    const element = (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }} onClick={onClose}>
            <div style={{ width: '600px', background: '#1e2127', borderRadius: '8px', border: '1px solid #3d4450', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                <GSEGameSettings appId={appId} />
                <div style={{ padding: '15px', textAlign: 'right', borderTop: '1px solid #333' }}><DialogButton onClick={onClose}>Close</DialogButton></div>
            </div>
        </div>
    );

    if (rd.createRoot) {
        modalRoot._root = rd.createRoot(modalRoot);
        modalRoot._root.render(element);
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

    // 1. Links Bar Injection
    const linksBar = doc.querySelector('.DgVQapkBmhAW6oPY5rPZo');
    if (linksBar) {
        const existing = linksBar.querySelector('.gse-details-button');
        
        // Find the absolute right edge of the last Steam button
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
                (existing as HTMLElement).style.left = `${nextLeft}px`;
                (existing as any).onclick = () => showGSEConfig(appId); // Update appId
            }
        }
    }

    // 2. General Properties Injection
    const generalTarget = Array.from(doc.querySelectorAll('*')).find((el: any) => 
        (el.innerText === 'Launch Options' || el.innerText === 'LAUNCH OPTIONS' || el.innerText === 'Steam Cloud') && el.offsetWidth > 0
    );
    if (generalTarget && !doc.querySelector('.gse-general-injected')) {
        const target = generalTarget.closest('[class*="Section"]') || generalTarget.parentElement;
        const rd = getReactDOM();
        if (target && rd) {
            const injectDiv = doc.createElement('div');
            injectDiv.className = 'gse-general-injected';
            injectDiv.style.cssText = 'margin: 20px 0; padding: 20px; background: rgba(0,0,0,0.3); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);';
            target.parentElement?.insertBefore(injectDiv, target);
            if (rd.createRoot) rd.createRoot(injectDiv).render(<GSEGameSettings appId={appId} />);
            else rd.render(<GSEGameSettings appId={appId} />, injectDiv);
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
        content: <div style={{padding: '20px'}}>Check Game Properties or Details to configure achievements.</div>,
    };
});
