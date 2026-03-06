local millennium = require("millennium")
local filesystem = require("filesystem")
local json = require("json")

local settings_path = "settings.json"
local configs = {}
local last_status_map = {}

-- Utility to read and parse JSON
local function read_json(path)
    if not filesystem.exists(path) then return nil end
    local content = filesystem.read_file(path)
    local status, data = pcall(json.decode, content)
    if status then return data else return nil end
end

-- Utility to save JSON
local function save_json(path, data)
    local content = json.encode(data)
    return filesystem.write_file(path, content)
end

-- Check for new achievements
local function check_achievements()
    for app_id, config in pairs(configs) do
        local status_path = config.status_path
        if status_path and filesystem.exists(status_path) then
            local current_status = read_json(status_path)
            if current_status then
                local last_status = last_status_map[app_id] or {}
                
                for ach_id, data in pairs(current_status) do
                    local was_unlocked = last_status[ach_id] and last_status[ach_id].unlocked or false
                    local is_unlocked = data.unlocked or false
                    
                    if is_unlocked and not was_unlocked then
                        -- Fetch name from interface file
                        local interface_path = config.interface_path
                        local display_name = ach_id
                        local description = ""
                        local icon = ""
                        
                        local achievements_meta = read_json(interface_path)
                        if achievements_meta then
                            for _, ach in ipairs(achievements_meta) do
                                if ach.name == ach_id then
                                    display_name = ach.display_name or ach_id
                                    description = ach.description or ""
                                    if ach.icon then
                                        local base_dir = interface_path:match("(.*[\\/])") or ""
                                        icon = base_dir .. "img/" .. ach.icon
                                    end
                                    break
                                end
                            end
                        end
                        
                        -- Notify frontend
                        millennium.emit("achievement_earned", {
                            app_id = app_id,
                            ach_id = ach_id,
                            name = display_name,
                            description = description,
                            icon = icon
                        })
                    end
                end
                last_status_map[app_id] = current_status
            end
        end
    end
end

-- API called from frontend
local function get_game_config(payload)
    local app_id = tostring(payload.app_id)
    return configs[app_id] or {}
end

local function save_game_config(payload)
    local app_id = tostring(payload.app_id)
    configs[app_id] = {
        interface_path = payload.interface_path,
        status_path = payload.status_path
    }
    save_json(settings_path, configs)
    
    local status = read_json(payload.status_path)
    if status then last_status_map[app_id] = status end
    
    return { success = true }
end

local function get_achievements(payload)
    local app_id = tostring(payload.app_id)
    local config = configs[app_id]
    if not config then return {} end
    
    local meta = read_json(config.interface_path) or {}
    local status = read_json(config.status_path) or {}
    
    for _, ach in ipairs(meta) do
        local ach_status = status[ach.name] or {}
        ach.unlocked = ach_status.unlocked or false
        ach.unlock_time = ach_status.unlock_time or 0
        
        local base_dir = config.interface_path:match("(.*[\\/])") or ""
        if ach.icon then ach.icon_path = base_dir .. "img/" .. ach.icon end
        if ach.icongray then ach.icongray_path = base_dir .. "img/" .. ach.icongray end
    end
    
    return meta
end

-- Plugin lifecycle
local function on_load()
    print("GSE Achievements: Backend initializing...")
    
    local data = read_json(settings_path)
    if data then configs = data end
    
    for app_id, config in pairs(configs) do
        local status = read_json(config.status_path)
        if status then last_status_map[app_id] = status end
    end
    
    -- Start polling (3 seconds)
    if Steam and Steam.SetInterval then
        Steam.SetInterval(3000, check_achievements)
    end
    
    millennium.ready()
    print("GSE Achievements: Backend ready.")
end

local function on_frontend_loaded()
    print("GSE Achievements: Frontend connected.")
end

local function on_unload()
    print("GSE Achievements: Backend unloading.")
end

return {
    on_load = on_load,
    on_frontend_loaded = on_frontend_loaded,
    on_unload = on_unload,
    get_game_config = get_game_config,
    save_game_config = save_game_config,
    get_achievements = get_achievements
}
