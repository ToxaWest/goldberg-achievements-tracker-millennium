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
        log(`Calling Backend: ${method}`, args);
        const res = await m.callServerMethod("goldberg-achievements", method, args.app_id, args.interface_path || "", args.status_path || "");
        log(`Backend Result (${method}):`, res);
        if (typeof res === 'string' && (res.startsWith('{') || res.startsWith('['))) {
            try { return JSON.parse(res); } catch (e) { return res; }
        }
        return res;
    } catch (e) {
        log(`Backend Error (${method}):`, e);
        return null;
    }
};

const notify = (title: string, message: string) => {
    try {
        const sc = getGlobal('SteamClient');
        const fn = sc?.Notifications?.DisplayNotification || sc?.DisplayNotification;
        if (typeof fn === 'function') {
            fn.call(sc?.Notifications || sc, title, message, "", "");
        } else {
            log("NOTIFICATION (No Native):", title, message);
        }
    } catch (e) {
        log("Notify failed:", e);
    }
};

const AchievementItem = ({ a }: { a: any }) => {
    // Goldberg icons are relative to the interface file.
    // We'll try to load them, but handle failures gracefully.
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

    const btnRef = React.useRef<HTMLButtonElement>(null);
    const iPickerRef = React.useRef<HTMLButtonElement>(null);
    const sPickerRef = React.useRef<HTMLButtonElement>(null);

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
        log("Browse Clicked");
        const sc = getGlobal('SteamClient');
        const picker = sc?.Window?.OpenFilePicker || sc?.Browser?.OpenFilePicker || sc?.OpenFilePicker;
        
        if (typeof picker !== 'function') {
            log("Picker not found.");
            notify("GSE Error", "File picker not found in this window.");
            return;
        }

        try {
            const path = await picker("Select achievements.json", "", false);
            if (path) {
                const normalized = path.replace(/\\/g, '/').replace(/"/g, '').trim();
                log("Path Selected:", normalized);
                setter(normalized);
            }
        } catch (e) {
            log("Picker Error:", e);
        }
    };

    const handleSave = async () => {
        log("Save Clicked", { appId, interfacePath, statusPath });
        const res = await callBackend('save_game_config', { 
            app_id: appId, 
            interface_path: interfacePath, 
            status_path: statusPath 
        });
        
        if (res && res.success) {
            notify("GSE Achievements", "Settings saved successfully!");
            loadData();
        } else {
            notify("GSE Error", "Save failed. Check console.");
        }
    };

    // Use direct DOM listeners as a nuclear option for Steam UI compatibility
    React.useEffect(() => {
        const saveBtn = btnRef.current;
        const iBtn = iPickerRef.current;
        const sBtn = sPickerRef.current;

        const onSave = (e: Event) => { e.preventDefault(); handleSave(); };
        const onIBrowse = (e: Event) => { e.preventDefault(); handleBrowse(setInterfacePath); };
        const onSBrowse = (e: Event) => { e.preventDefault(); handleBrowse(setStatusPath); };

        saveBtn?.addEventListener('click', onSave);
        iBtn?.addEventListener('click', onIBrowse);
        sBtn?.addEventListener('click', onSBrowse);

        return () => {
            saveBtn?.removeEventListener('click', onSave);
            iBtn?.removeEventListener('click', onIBrowse);
            sBtn?.removeEventListener('click', onSBrowse);
        };
    }, [interfacePath, statusPath, appId]);

    if (isLoading) return <div style={{padding: '20px', color: '#888'}}>Loading configuration...</div>;

    return (
        <div style={{ padding: '25px', color: 'white', backgroundColor: '#1b2838', borderRadius: '4px', fontFamily: 'system-ui, sans-serif' }}>
            <h2 style={{ marginBottom: '20px', fontSize: '18px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>GSE Settings</h2>
            
            <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', color: '#888', fontSize: '11px', marginBottom: '5px' }}>METADATA PATH (achievements.json)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                        style={{ flex: 1, background: '#121418', border: '1px solid #333', padding: '8px', color: 'white' }}
                        value={interfacePath} 
                        onChange={e => setInterfacePath(e.target.value)} 
                    />
                    <button ref={iPickerRef} style={{ background: '#333', border: 'none', color: 'white', padding: '0 12px', cursor: 'pointer' }}>📁</button>
                </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#888', fontSize: '11px', marginBottom: '5px' }}>STATUS PATH (achievements.json)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                        style={{ flex: 1, background: '#121418', border: '1px solid #333', padding: '8px', color: 'white' }}
                        value={statusPath} 
                        onChange={e => setStatusPath(e.target.value)} 
                    />
                    <button ref={sPickerRef} style={{ background: '#333', border: 'none', color: 'white', padding: '0 12px', cursor: 'pointer' }}>📁</button>
                </div>
            </div>

            <button ref={btnRef} style={{ width: '100%', background: '#1a9fff', border: 'none', color: 'white', padding: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Save Settings</button>

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
        content: <div style={{padding: '20px'}}>GSE active.</div>,
    };
});
