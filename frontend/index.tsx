import { Millennium, definePlugin, callable, IconsModule } from '@steambrew/client';
import React from 'react';

const getGameConfig = callable<[{ app_id: string }], any>('get_game_config');
const getAchievements = callable<[{ app_id: string }], any>('get_achievements');
const saveGameConfig = callable<[{ app_id: string; interface_path: string; status_path: string }], any>('save_game_config');

const log = (...args: any[]) => console.log("[GSE]", ...args);

let lastAppId: string | null = null;

const notify = (title: string, message: string) => {
    try {
        (window as any).SteamClient?.Notifications?.DisplayNotification(title, message, "", "");
    } catch (e) {
        log("Notification failed:", title, message);
    }
};

const steamRender = (element: React.ReactElement, container: HTMLElement) => {
    try {
        const rd = (window as any).SP_REACTDOM;
        if (!rd) return;
        if (rd.createRoot) {
            if (!(container as any)._gseRoot) (container as any)._gseRoot = rd.createRoot(container);
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
    const [isLoading, setIsLoading] = React.useState(true);
    const gameName = getGameName(appId);

    React.useEffect(() => {
        const load = async () => {
            try {
                const config = await getGameConfig({ app_id: appId });
                if (config) {
                    setInterfacePath(config.interface_path || '');
                    setStatusPath(config.status_path || '');
                }
                const data = await getAchievements({ app_id: appId });
                setAchievements(data || []);
            } catch (e) {
                log("Load error:", e);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [appId]);

    const handleBrowse = async (setter: (val: string) => void) => {
        const client = (window as any).SteamClient;
        if (client?.Window?.OpenFilePicker) {
            const path = await client.Window.OpenFilePicker("Select achievements.json", "", false);
            if (path) setter(path.replace(/\\/g, '/').replace(/"/g, '').trim());
        }
    };

    const handleSave = async () => {
        log("Save requested for", appId);
        const res = await saveGameConfig({ 
            app_id: appId, 
            interface_path: interfacePath, 
            status_path: statusPath 
        });
        if (res?.success) {
            notify("GSE Achievements", `Saved settings for ${gameName}`);
            const data = await getAchievements({ app_id: appId });
            setAchievements(data || []);
        } else {
            notify("GSE Error", "Failed to save settings.");
        }
    };

    if (isLoading) return <div style={{padding: '20px', color: '#888'}}>Loading configuration...</div>;

    return (
        <div style={{ padding: '25px', color: 'white', backgroundColor: '#1b2838', borderRadius: '4px', fontFamily: 'system-ui, sans-serif' }}>
            <h2 style={{ marginBottom: '20px', fontSize: '18px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>{gameName}</h2>
            
            <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', color: '#888', fontSize: '12px', marginBottom: '5px' }}>Interface Path (achievements.json metadata)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                        style={{ flex: 1, background: '#121418', border: '1px solid #3d4450', padding: '8px', color: 'white', borderRadius: '4px' }}
                        value={interfacePath} 
                        onChange={e => setInterfacePath(e.target.value)} 
                    />
                    <button 
                        style={{ background: '#3d4450', border: 'none', color: 'white', padding: '0 12px', borderRadius: '4px', cursor: 'pointer' }}
                        onClick={() => handleBrowse(setInterfacePath)}
                    >📁</button>
                </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#888', fontSize: '12px', marginBottom: '5px' }}>Status Path (achievements.json unlock status)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                        style={{ flex: 1, background: '#121418', border: '1px solid #3d4450', padding: '8px', color: 'white', borderRadius: '4px' }}
                        value={statusPath} 
                        onChange={e => setStatusPath(e.target.value)} 
                    />
                    <button 
                        style={{ background: '#3d4450', border: 'none', color: 'white', padding: '0 12px', borderRadius: '4px', cursor: 'pointer' }}
                        onClick={() => handleBrowse(setStatusPath)}
                    >📁</button>
                </div>
            </div>

            <button 
                style={{ width: '100%', background: '#1a9fff', border: 'none', color: 'white', padding: '12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
                onClick={handleSave}
            >Save Settings</button>

            {achievements.length > 0 && (
                <div style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '15px' }}>
                    <div style={{ color: '#888', fontSize: '12px', marginBottom: '10px' }}>
                        {achievements.filter(a=>a.unlocked).length} / {achievements.length} Achievements
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px', maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '10px' }}>
                        {achievements.map(a => (
                            <div key={a.name} style={{ fontSize: '11px', color: a.unlocked ? '#4caf50' : '#666', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
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
            <div style={{ width: '600px', background: '#1e2127', borderRadius: '8px', border: '1px solid #3d4450' }} onClick={e => e.stopPropagation()}>
                <GSEGameSettings appId={appId} />
                <div style={{ padding: '10px', textAlign: 'right', borderTop: '1px solid #333' }}>
                    <button style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }} onClick={onClose}>Close</button>
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
        content: <div style={{padding: '20px'}}>GSE plugin active.</div>,
    };
});
