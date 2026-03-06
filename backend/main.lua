local millennium = require("millennium")
local json = require("json")

local settings_path = "settings.json"
local configs = {}
local last_status_map = {}

-- Standard Lua file helpers
local function file_exists(path)
    local f = io.open(path, "rb")
    if f then f:close() end
    return f ~= nil
end

local function read_file(path)
    local f = io.open(path, "rb")
    if not f then return nil end
    local content = f:read("*all")
    f:close()
    return content
end

local function write_file(path, content)
    local f = io.open(path, "wb")
    if not f then return false end
    f:write(content)
    f:close()
    return true
end

-- JSON wrappers
local function decode_json(content)
    if not content then return nil end
    local status, data = pcall(json.decode, content)
    return status and data or nil
end

local function encode_json(data)
    return json.encode(data)
end

-- Achievement check logic
local function check_achievements()
    for app_id, config in pairs(configs) do
        local status_path = config.status_path
        if status_path and file_exists(status_path) then
            local current_status = decode_json(read_file(status_path))
            if current_status then
                local last_status = last_status_map[app_id] or {}
                for ach_id, data in pairs(current_status) do
                    local was_unlocked = last_status[ach_id] and last_status[ach_id].unlocked
                    local is_unlocked = data.unlocked
                    
                    if is_unlocked and not was_unlocked then
                        print("GSE Achievements: Achievement earned! " .. app_id .. " - " .. ach_id)
                        
                        local display_name = ach_id
                        local description = ""
                        local icon = ""
                        
                        local meta = decode_json(read_file(config.interface_path))
                        if meta then
                            for _, ach in ipairs(meta) do
                                if ach.name == ach_id then
                                    display_name = ach.display_name or ach_id
                                    description = ach.description or ""
                                    if ach.icon then
                                        local base_dir = config.interface_path:match("(.*[\\/])") or ""
                                        icon = base_dir .. "img/" .. ach.icon
                                    end
                                    break
                                end
                            end
                        end
                        
                        millennium.emit("achievement_earned", {
                            app_id = app_id, ach_id = ach_id, name = display_name, description = description, icon = icon
                        })
                    end
                end
                last_status_map[app_id] = current_status
            end
        end
    end
end

-- Exported functions
local function get_game_config(payload)
    return configs[tostring(payload.app_id)] or {}
end

local function save_game_config(payload)
    local app_id = tostring(payload.app_id)
    configs[app_id] = { interface_path = payload.interface_path, status_path = payload.status_path }
    write_file(settings_path, encode_json(configs))
    
    local status = decode_json(read_file(payload.status_path))
    if status then last_status_map[app_id] = status end
    return { success = true }
end

local function get_achievements(payload)
    local app_id = tostring(payload.app_id)
    local config = configs[app_id]
    if not config then return {} end
    
    local meta = decode_json(read_file(config.interface_path)) or {}
    local status = decode_json(read_file(config.status_path)) or {}
    
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

-- Lifecycle
local function on_load()
    print("GSE Achievements: Backend starting...")
    local data = decode_json(read_file(settings_path))
    if data then configs = data end
    
    for app_id, config in pairs(configs) do
        local status = decode_json(read_file(config.status_path))
        if status then last_status_map[app_id] = status end
    end
    
    -- Using Steam global timer if available
    if Steam and Steam.SetInterval then
        Steam.SetInterval(3000, check_achievements)
    end
    
    millennium.ready()
    print("GSE Achievements: Backend ready.")
end

return {
    on_load = on_load,
    get_game_config = get_game_config,
    save_game_config = save_game_config,
    get_achievements = get_achievements
}
