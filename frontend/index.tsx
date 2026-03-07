import { Millennium, definePlugin, callable, IconsModule, Field, DialogButton, TextField } from '@steambrew/client';
import React from 'react';

const getGameConfig = callable<[{ app_id: string }], any>('get_game_config');
const getAchievements = callable<[{ app_id: string }], any>('get_achievements');
const saveGameConfig = callable<[{ app_id: string; interface_path: string; status_path: string }], any>('save_game_config');

const log = (...args: any[]) => console.log("[GSE]", ...args);

let lastAppId: string | null = null;

/**
 * Robust renderer using Steam's internal SP_REACTDOM
 */
const steamRender = (element: React.ReactElement, container: HTMLElement) => {
    try {
        const rd = (window as any).SP_REACTDOM;
        if (!rd) {
            log("SP_REACTDOM not found, falling back to vanilla innerHTML");
            return;
        }

        if (rd.createRoot) {
            if (!(container as any)._gseRoot) {
                (container as any)._gseRoot = rd.createRoot(container);
            }
            (container as any)._gseRoot.render(element);
        } else {
            rd.render(element, container);
        }
    } catch (e) {
        log("Steam Render Error:", e);
    }
};

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

    const loadConfig = async () => {
        const config = await getGameConfig({ app_id: appId });
        setInterfacePath(config.interface_path || '');
        setStatusPath(config.status_path || '');
        const data = await getAchievements({ app_id: appId });
        setAchievements(data || []);
    };

    React.useEffect(() => { loadConfig(); }, [appId]);

    const handleSave = async () => {
        const res = await saveGameConfig({ 
            app_id: appId, 
            interface_path: interfacePath.replace(/\\/g, '/').replace(/"/g, '').trim(), 
            status_path: statusPath.replace(/\\/g, '/').replace(/"/g, '').trim() 
        });
        if (res?.success) {
            const data = await getAchievements({ app_id: appId });
            setAchievements(data || []);
        }
    };

    return (
        <div style={{ padding: '25px', color: 'white', backgroundColor: '#1b2838', borderRadius: '4px' }}>
            <h2 style={{ marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>{gameName}</h2>
            
            <Field label="Interface Path (Metadata)">
                <TextField value={interfacePath} onChange={(e:any)=>setInterfacePath(e.target.value)} />
            </Field>
            
            <Field label="Status Path (Unlocked)">
                <TextField value={statusPath} onChange={(e:any)=>setStatusPath(e.target.value)} />
            </Field>
            
            <DialogButton onClick={handleSave} style={{ width: '100%', marginTop: '20px' }}>Save Settings</DialogButton>
            
            {achievements.length > 0 && (
                <div style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '15px' }}>
                    <div style={{ marginBottom: '10px', fontSize: '14px', color: '#888' }}>
                        {achievements.filter(a=>a.unlocked).length} / {achievements.length} Achievements
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px', maxHeight: '200px', overflowY: 'auto', padding: '10px', background: 'rgba(0,0,0,0.2)' }}>
                        {achievements.map(a => (
                            <div key={a.name} style={{ fontSize: '11px', color: a.unlocked ? '#4caf50' : '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {a.unlocked ? '✅' : '🔒'} {a.display_name || a.name}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const showGSEConfig = (appId: string, doc: Document) => {
    const modalRoot = doc.createElement('div');
    doc.body.appendChild(modalRoot);
    
    const onClose = () => {
        const rd = (window as any).SP_REACTDOM;
        if (rd?.unmountComponentAtNode) rd.unmountComponentAtNode(modalRoot);
        else if ((modalRoot as any)._gseRoot) (modalRoot as any)._gseRoot.unmount();
        modalRoot.remove();
    };

    steamRender(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }} onClick={onClose}>
            <div style={{ width: '600px', background: '#1e2127', borderRadius: '8px', border: '1px solid #3d4450', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                <GSEGameSettings appId={appId} />
                <div style={{ padding: '15px', textAlign: 'right', borderTop: '1px solid #333' }}>
                    <DialogButton onClick={onClose}>Close</DialogButton>
                </div>
            </div>
        </div>,
        modalRoot
    );
};

const processInjection = async (doc: Document) => {
    const appId = await getAppId(doc);
    if (!appId) return;

    if (appId !== lastAppId) {
        log("Game Page:", appId);
        lastAppId = appId;
    }

    // 1. Links Bar
    const linksBar = doc.querySelector('.DgVQapkBmhAW6oPY5rPZo');
    if (linksBar && !linksBar.querySelector('.gse-details-button')) {
        const steamButtons = Array.from(linksBar.children).filter(c => (c as HTMLElement).style.left);
        const lastSteamBtn = steamButtons.sort((a,b) => parseInt((a as HTMLElement).style.left) - parseInt((b as HTMLElement).style.left)).pop() as HTMLElement;
        const nextLeft = lastSteamBtn ? parseInt(lastSteamBtn.style.left) + lastSteamBtn.offsetWidth + 8 : 0;
        
        const btn = doc.createElement('div');
        btn.className = '_7k4qmaN8SUMvv6u-L81uk gse-details-button';
        btn.style.cssText = `left: ${nextLeft}px; top: 0px; position: absolute;`;
        btn.innerHTML = `<div role="link" class="DY4_wSF8h9T5o46hO5I9V Panel" tabindex="0"><div class="_1b6LYWVijW-9E4YV0keDWZ"><span class="_2sNDjgK9EWiPLdNGkjun-w">GSE Achievements</span></div></div>`;
        
        const clickable = btn.querySelector('.DY4_wSF8h9T5o46hO5I9V');
        if (clickable) {
            clickable.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                showGSEConfig(appId, doc);
            });
        }
        linksBar.appendChild(btn);
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
            injectDiv.style.cssText = 'margin: 20px 0; padding: 20px; background: rgba(0,0,0,0.3); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);';
            target.parentElement?.insertBefore(injectDiv, target);
            steamRender(<GSEGameSettings appId={appId} />, injectDiv);
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
        content: <div style={{padding: '20px'}}>GSE Achievements is running. Configure per-game in Details or Properties.</div>,
    };
});
