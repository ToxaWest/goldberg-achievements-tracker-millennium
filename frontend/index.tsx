import { Millennium, definePlugin, IconsModule } from '@steambrew/client';
import React from 'react';

const log = (...args: any[]) => console.log("[GSE]", ...args);

/**
 * Robust global discovery
 */
const getGlobal = (name: string): any => {
    const win = window as any;
    if (win[name]) return win[name];
    try {
        if (win.opener && win.opener[name]) return win.opener[name];
        if (win.top && win.top[name]) return win.top[name];
        if (win.parent && win.parent[name]) return win.parent[name];
    } catch (e) {}
    
    const manager = win.MainWindowBrowserManager || win.opener?.MainWindowBrowserManager;
    if (manager) {
        if (manager[name]) return manager[name];
        if (manager.m_browser && manager.m_browser[name]) return manager.m_browser[name];
    }
    return null;
};

const callBackend = async (method: string, args: any) => {
    const m = getGlobal('Millennium');
    if (!m?.callServerMethod) return null;
    try {
        log(`Backend Call: ${method}`, args);
        // Explicitly pass arguments as a single object
        const res = await m.callServerMethod("goldberg-achievements", method, args);
        log(`Backend Raw Result (${method}):`, res);
        
        if (typeof res === 'string') {
            try { return JSON.parse(res); } catch (e) { return res; }
        }
        return res;
    } catch (e) {
        log(`Backend Call Error (${method}):`, e);
        return null;
    }
};

const notify = (title: string, message: string) => {
    const sc = getGlobal('SteamClient');
    // Notification function is often in sc.Notifications or top-level
    const fn = sc?.Notifications?.DisplayNotification || sc?.DisplayNotification;
    if (typeof fn === 'function') {
        fn.call(sc?.Notifications || sc, title, message, "", "");
    } else {
        log("NOTIFY FALLBACK:", title, message);
    }
};

const GSEGameSettings = ({ appId }: { appId: string }) => {
    const [interfacePath, setInterfacePath] = React.useState('');
    const [statusPath, setStatusPath] = React.useState('');
    const [achievements, setAchievements] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const load = async () => {
            const config = await callBackend('get_game_config', { app_id: appId });
            if (config) {
                setInterfacePath(config.interface_path || '');
                setStatusPath(config.status_path || '');
            }
            const data = await callBackend('get_achievements', { app_id: appId });
            setAchievements(Array.isArray(data) ? data : []);
            setLoading(false);
        };
        load();
    }, [appId]);

    const handleBrowse = async (setter: (val: string) => void) => {
        const sc = getGlobal('SteamClient');
        // File picker location check
        const picker = sc?.Window?.OpenFilePicker || sc?.Browser?.OpenFilePicker || sc?.OpenFilePicker;
        
        if (typeof picker !== 'function') {
            log("OpenFilePicker not found. Context:", sc ? "SteamClient found" : "SteamClient missing");
            alert("File picker not found. Please paste path manually.");
            return;
        }

        try {
            log("Opening File Picker...");
            const path = await picker.call(sc?.Window || sc?.Browser || sc, "Select achievements.json", "", false);
            if (path) {
                const normalized = path.replace(/\\/g, '/').replace(/"/g, '').trim();
                log("File selected:", normalized);
                setter(normalized);
            }
        } catch (e) {
            log("File Picker exception:", e);
        }
    };

    const handleSave = async () => {
        log("Save requested for AppID:", appId);
        const res = await callBackend('save_game_config', { 
            app_id: appId, 
            interface_path: interfacePath, 
            status_path: statusPath 
        });
        
        if (res && res.success) {
            notify("GSE Achievements", "Settings saved successfully!");
            const data = await callBackend('get_achievements', { app_id: appId });
            setAchievements(Array.isArray(data) ? data : []);
        } else {
            log("Backend reported failure:", res);
            notify("GSE Error", "Failed to save settings. See console.");
        }
    };

    if (loading) return <div style={{padding: '20px', color: '#888'}}>Loading...</div>;

    return (
        <div style={{ padding: '25px', color: 'white', backgroundColor: '#1b2838', borderRadius: '4px', fontFamily: 'system-ui, sans-serif' }}>
            <h2 style={{ marginBottom: '20px', fontSize: '18px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>GSE Achievement Tracking</h2>
            
            <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', color: '#888', fontSize: '11px', marginBottom: '5px' }}>METADATA PATH (achievements.json)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input style={{ flex: 1, background: '#121418', border: '1px solid #333', padding: '8px', color: 'white' }} value={interfacePath} onChange={e => setInterfacePath(e.target.value)} />
                    <button style={{ background: '#333', border: 'none', color: 'white', padding: '0 12px', cursor: 'pointer' }} onClick={() => handleBrowse(setInterfacePath)}>📁</button>
                </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#888', fontSize: '11px', marginBottom: '5px' }}>STATUS PATH (achievements.json)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input style={{ flex: 1, background: '#121418', border: '1px solid #333', padding: '8px', color: 'white' }} value={statusPath} onChange={e => setStatusPath(e.target.value)} />
                    <button style={{ background: '#333', border: 'none', color: 'white', padding: '0 12px', cursor: 'pointer' }} onClick={() => handleBrowse(setStatusPath)}>📁</button>
                </div>
            </div>

            <button style={{ width: '100%', background: '#1a9fff', border: 'none', color: 'white', padding: '12px', fontWeight: 'bold', cursor: 'pointer' }} onClick={handleSave}>Save Configuration</button>

            {achievements.length > 0 && (
                <div style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '15px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '5px', maxHeight: '150px', overflowY: 'auto' }}>
                        {achievements.map(a => (
                            <div key={a.name} style={{ fontSize: '10px', color: a.unlocked ? '#4caf50' : '#666', whiteSpace: 'nowrap', overflow: 'hidden' }}>
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
    const rd = getGlobal('SP_REACTDOM');
    const onClose = () => {
        if (rd?.unmountComponentAtNode) rd.unmountComponentAtNode(modalRoot);
        else if ((modalRoot as any)._gseRoot) (modalRoot as any)._gseRoot.unmount();
        modalRoot.remove();
    };
    const element = (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }} onClick={onClose}>
            <div style={{ width: '500px', background: '#1e2127', borderRadius: '4px' }} onClick={e => e.stopPropagation()}>
                <GSEGameSettings appId={appId} />
                <div style={{ padding: '10px', textAlign: 'right', borderTop: '1px solid #333' }}>
                    <button style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }} onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
    if (rd?.createRoot) {
        if (!(modalRoot as any)._gseRoot) (modalRoot as any)._gseRoot = rd.createRoot(modalRoot);
        (modalRoot as any)._gseRoot.render(element);
    } else if (rd?.render) {
        rd.render(element, modalRoot);
    }
};

let lastAppId: string | null = null;

const processInjection = async (doc: Document) => {
    const manager = getGlobal('MainWindowBrowserManager');
    let appId = null;
    if (manager?.m_lastLocation?.pathname) {
        const match = manager.m_lastLocation.pathname.match(/\/app\/(\d+)/);
        if (match) appId = match[1];
    }
    if (!appId) {
        const match = doc.location.href.match(/\/app\/(\d+)/) || doc.location.href.match(/appid=(\d+)/);
        if (match) appId = match[1];
    }
    if (!appId) {
        const images = doc.querySelectorAll('img[src*="/assets/"]');
        for (const img of Array.from(images) as HTMLImageElement[]) {
            const match = img.src.match(/\/assets\/(\d+)/);
            if (match) { appId = match[1]; break; }
        }
    }
    if (!appId) return;

    if (appId !== lastAppId) {
        log("Found game page for appId:", appId);
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
        btn.querySelector('.DY4_wSF8h9T5o46hO5I9V')?.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            showGSEConfig(appId!, doc);
        });
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
