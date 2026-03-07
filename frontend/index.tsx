import { Millennium, definePlugin, IconsModule } from '@steambrew/client';
import React from 'react';

const log = (...args: any[]) => console.log("[GSE]", ...args);

/**
 * Robust global discovery
 */
const getGlobal = (name: string): any => {
    const win = window as any;
    const sources = [win, win.opener, win.top, win.parent];
    for (const s of sources) {
        if (s && s[name]) return s[name];
    }
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
        log(`Backend Call Attempt: ${method}`, args);
        // PASS POSITIONALLY: (app_id, interface, status)
        // This is the most reliable way to bypass argument shifting issues
        const res = await m.callServerMethod("goldberg-achievements", method, args.app_id, args.interface_path || "", args.status_path || "");
        log(`Backend Response Received (${method}):`, res);
        if (typeof res === 'string') {
            try { return JSON.parse(res); } catch (e) { return res; }
        }
        return res;
    } catch (e) {
        log(`Backend Call Exception (${method}):`, e);
        return null;
    }
};

const AchievementItem = ({ a }: { a: any }) => {
    const iconUrl = a.icon ? "file:///" + a.icon.replace(/\\/g, '/') : null;
    return (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
            <div style={{ width: '32px', height: '32px', background: '#222', flexShrink: 0, borderRadius: '3px', overflow: 'hidden' }}>
                {iconUrl && <img src={iconUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: a.unlocked ? 1 : 0.2 }} onError={(e:any) => e.target.style.display='none'} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: a.unlocked ? '#fff' : '#777', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.display_name}
                </div>
                {a.description && <div style={{ fontSize: '10px', color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.description}</div>}
            </div>
            {a.unlocked && <div style={{ color: '#4caf50', fontSize: '12px' }}>✓</div>}
        </div>
    );
};

const GSEGameSettings = ({ appId }: { appId: string }) => {
    const [interfacePath, setInterfacePath] = React.useState('');
    const [statusPath, setStatusPath] = React.useState('');
    const [achievements, setAchievements] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    const loadData = async () => {
        const config = await callBackend('get_game_config', { app_id: appId });
        if (config) {
            setInterfacePath(config.interface_path || '');
            setStatusPath(config.status_path || '');
        }
        const data = await callBackend('get_achievements', { app_id: appId });
        setAchievements(Array.isArray(data) ? data : []);
        setIsLoading(false);
    };

    React.useEffect(() => {
        loadData();
    }, [appId]);

    const handleBrowse = async (setter: (val: string) => void) => {
        log("Browse button clicked");
        const sc = getGlobal('SteamClient');
        
        // DEEP SCAN for OpenFilePicker
        const findPicker = (obj: any, depth = 0): any => {
            if (!obj || depth > 2) return null;
            if (typeof obj.OpenFilePicker === 'function') return obj.OpenFilePicker.bind(obj);
            
            for (const key of Object.keys(obj)) {
                try {
                    const found = findPicker(obj[key], depth + 1);
                    if (found) return found;
                } catch(e) {}
            }
            return null;
        };

        const picker = findPicker(sc) || findPicker((window as any).opener?.SteamClient) || findPicker((window as any).top?.SteamClient);
        
        if (!picker) {
            log("CRITICAL: OpenFilePicker not found even after deep scan.");
            alert("Native file picker not found. Please paste path manually.");
            return;
        }

        try {
            log("Found picker! Launching...");
            const path = await picker("Select achievements.json", "", false);
            if (path) {
                const normalized = path.replace(/\\/g, '/').replace(/"/g, '').trim();
                log("Path selected:", normalized);
                setter(normalized);
            }
        } catch (e) {
            log("Picker Execution Error:", e);
        }
    };

    const handleSave = async () => {
        log("Save button clicked", { appId, interfacePath, statusPath });
        const res = await callBackend('save_game_config', { app_id: appId, interface_path: interfacePath, status_path: statusPath });
        if (res && res.success) {
            log("Save successful!");
            loadData();
        } else {
            log("Save failed message shown to user");
            alert("Save failed. Check Steam console for details.");
        }
    };

    if (isLoading) return <div style={{padding: '20px', color: '#888'}}>Syncing with backend...</div>;

    return (
        <div style={{ padding: '25px', color: 'white', backgroundColor: '#1b2838', borderRadius: '4px', fontFamily: 'system-ui, sans-serif' }}>
            <h2 style={{ marginBottom: '20px', fontSize: '18px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>GSE Achievement Settings</h2>
            
            <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', color: '#888', fontSize: '11px', marginBottom: '5px' }}>INTERFACE PATH (Metadata)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input style={{ flex: 1, background: '#121418', border: '1px solid #333', padding: '8px', color: 'white' }} value={interfacePath} onChange={e => setInterfacePath(e.target.value)} />
                    <button style={{ background: '#333', border: 'none', color: 'white', padding: '0 12px', cursor: 'pointer' }} onClick={() => handleBrowse(setInterfacePath)}>📁</button>
                </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#888', fontSize: '11px', marginBottom: '5px' }}>STATUS PATH (Unlocks)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input style={{ flex: 1, background: '#121418', border: '1px solid #333', padding: '8px', color: 'white' }} value={statusPath} onChange={e => setStatusPath(e.target.value)} />
                    <button style={{ background: '#333', border: 'none', color: 'white', padding: '0 12px', cursor: 'pointer' }} onClick={() => handleBrowse(setStatusPath)}>📁</button>
                </div>
            </div>

            <button style={{ width: '100%', background: '#1a9fff', border: 'none', color: 'white', padding: '12px', fontWeight: 'bold', cursor: 'pointer' }} onClick={handleSave}>Save Settings</button>

            {achievements.length > 0 && (
                <div style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '15px' }}>
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px' }}>
                        {achievements.filter(a=>a.unlocked).length} / {achievements.length} Achievements
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', maxHeight: '250px', overflowY: 'auto', paddingRight: '5px' }}>
                        {achievements.map(a => <AchievementItem key={a.name} a={a} />)}
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
            <div style={{ width: '600px', background: '#1e2127', borderRadius: '4px' }} onClick={e => e.stopPropagation()}>
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
        log("Game Page Detect:", appId);
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
