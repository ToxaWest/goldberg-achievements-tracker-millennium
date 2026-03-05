import os
import json
import threading
import time

# Try to import millennium, if not available (during development), we'll mock it
try:
    import millennium
except ImportError:
    millennium = None

class AchievementWatcher(threading.Thread):
    def __init__(self, app_id, status_path, callback):
        super().__init__(daemon=True)
        self.app_id = app_id
        self.status_path = status_path
        self.callback = callback
        self.last_status = self._load_status()
        self.last_mtime = self._get_mtime()
        self.running = True

    def _load_status(self):
        try:
            if os.path.exists(self.status_path):
                with open(self.status_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            print(f"GSE Achievements: Error loading status for {self.app_id}: {e}")
        return {}

    def _get_mtime(self):
        try:
            if os.path.exists(self.status_path):
                return os.path.getmtime(self.status_path)
        except:
            pass
        return 0

    def stop(self):
        self.running = False

    def run(self):
        print(f"GSE Achievements: Started watcher thread for {self.app_id}")
        while self.running:
            time.sleep(3) # Increased poll interval for safety
            if not self.running:
                break
            mtime = self._get_mtime()
            if mtime > self.last_mtime:
                self.last_mtime = mtime
                new_status = self._load_status()
                for ach_id, data in new_status.items():
                    was_unlocked = self.last_status.get(ach_id, {}).get('unlocked', False)
                    is_unlocked = data.get('unlocked', False)
                    
                    if is_unlocked and not was_unlocked:
                        self.callback(self.app_id, ach_id)
                
                self.last_status = new_status

class Plugin:
    def __init__(self):
        self.settings_path = os.path.join(os.path.dirname(__file__), "settings.json")
        self.configs = {}
        self.watchers = {}
        print("GSE Achievements: Plugin class instantiated")

    def _load(self):
        """Standard Millennium v2 entry point"""
        print("GSE Achievements: _load() called")
        # Run initialization in a separate thread to ensure Steam startup is never blocked
        threading.Thread(target=self.run_logic, daemon=True).start()

    def _loader(self):
        """Alias for older versions"""
        print("GSE Achievements: _loader() called")
        self._load()

    def load(self):
        """Alias for older versions"""
        print("GSE Achievements: load() called")
        self._load()

    def run_logic(self):
        try:
            # Give Steam a moment to settle
            time.sleep(1)
            print("GSE Achievements: Initializing logic...")
            self.configs = self._load_configs()
            self._setup_watchers()
            print("GSE Achievements: Successfully loaded.")
        except Exception as e:
            print(f"GSE Achievements: Error in run_logic: {e}")

    def _unload(self):
        print("GSE Achievements: Unloading...")
        for watcher in self.watchers.values():
            watcher.stop()

    def _load_configs(self):
        if os.path.exists(self.settings_path):
            try:
                with open(self.settings_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"GSE Achievements: Error loading settings.json: {e}")
        return {}

    def _save_configs(self):
        try:
            with open(self.settings_path, 'w', encoding='utf-8') as f:
                json.dump(self.configs, f, indent=4)
        except Exception as e:
            print(f"GSE Achievements: Error saving settings.json: {e}")

    def _setup_watchers(self):
        for app_id, config in self.configs.items():
            status_path = config.get('status_path')
            if status_path and os.path.exists(status_path):
                self._add_watcher(app_id, status_path)

    def _add_watcher(self, app_id, status_path):
        if app_id in self.watchers:
            self.watchers[app_id].stop()
        
        watcher = AchievementWatcher(app_id, status_path, self._on_achievement_earned)
        watcher.start()
        self.watchers[app_id] = watcher

    def _on_achievement_earned(self, app_id, ach_id):
        print(f"GSE Achievements: Achievement earned: {app_id} - {ach_id}")
        achievements = self.get_achievements(app_id)
        ach_meta = next((a for a in achievements if a['name'] == ach_id), None)
        display_name = ach_meta['display_name'] if ach_meta else ach_id
        description = ach_meta['description'] if ach_meta else ""
        icon = ach_meta['icon_path'] if ach_meta else ""
        
        if millennium:
            millennium.emit_event('achievement_earned', { 
                'app_id': app_id, 
                'ach_id': ach_id,
                'name': display_name,
                'description': description,
                'icon': icon
            })

    def save_game_config(self, app_id, interface_path, status_path):
        self.configs[str(app_id)] = {
            'interface_path': interface_path,
            'status_path': status_path
        }
        self._save_configs()
        if os.path.exists(status_path):
            self._add_watcher(str(app_id), status_path)
        return {"success": True}

    def get_game_config(self, app_id):
        return self.configs.get(str(app_id), {})

    def get_achievements(self, app_id):
        config = self.configs.get(str(app_id))
        if not config:
            return []
        
        interface_path = config.get('interface_path')
        status_path = config.get('status_path')
        
        achievements = []
        if interface_path and os.path.exists(interface_path):
            try:
                with open(interface_path, 'r', encoding='utf-8') as f:
                    achievements = json.load(f)
            except Exception as e:
                print(f"GSE Achievements: Error reading interface file: {e}")
        
        status = {}
        if status_path and os.path.exists(status_path):
            try:
                with open(status_path, 'r', encoding='utf-8') as f:
                    status = json.load(f)
            except Exception as e:
                print(f"GSE Achievements: Error reading status file: {e}")
        
        for ach in achievements:
            ach_id = ach.get('name')
            ach_status = status.get(ach_id, {})
            ach['unlocked'] = ach_status.get('unlocked', False)
            ach['unlock_time'] = ach_status.get('unlock_time', 0)
            
            if 'icon' in ach:
                base_dir = os.path.dirname(interface_path)
                ach['icon_path'] = os.path.join(base_dir, 'img', ach['icon'])
            if 'icongray' in ach:
                base_dir = os.path.dirname(interface_path)
                ach['icongray_path'] = os.path.join(base_dir, 'img', ach['icongray'])

        return achievements
