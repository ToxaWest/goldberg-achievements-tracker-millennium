local millennium = require("millennium")
local json = require("json")

-- Resolve absolute path safely
local function get_plugin_dir()
    local path = "."
    if millennium.get_install_path then path = millennium.get_install_path() end
    return path:gsub("\\", "/"):gsub("/$", "")
end

local settings_path = get_plugin_dir() .. "/settings.json"
local configs = {}

-- Safe File/JSON Helpers
local function safe_read_file(path)
    if not path or path == "" then return nil end
    local f = io.open(path, "rb")
    if not f then return nil end
    local content = f:read("*all")
    f:close()
    return content
end

local function safe_write_file(path, content)
    local f = io.open(path, "wb")
    if not f then return false end
    f:write(content)
    f:close()
    return true
end

local function safe_decode(content)
    if not content or type(content) ~= "string" then return content end
    local status, result = pcall(json.decode, content)
    return status and result or nil
end

-- Extremely Robust Argument Parser
local function get_payload(...)
    local args = {...}
    print("GSE Debug: Received " .. #args .. " args")
    for i, v in ipairs(args) do print("  [" .. i .. "] " .. type(v) .. ": " .. tostring(v)) end

    local first = args[1]
    
    -- Case 1: First arg is a table (passed as object from JS)
    if type(first) == "table" then return first end
    
    -- Case 2: First arg is a string (might be JSON or just AppID)
    if type(first) == "string" then
        local decoded = safe_decode(first)
        if type(decoded) == "table" then return decoded end
        
        -- Case 3: Positional args (app_id, interface, status)
        return {
            app_id = first,
            interface_path = args[2] or "",
            status_path = args[3] or ""
        }
    end
    
    return {}
end

-- Exposed Methods
function get_game_config(...)
    local p = get_payload(...)
    local id = tostring(p.app_id or "nil")
    print("GSE: get_game_config for " .. id)
    return json.encode(configs[id] or {})
end

function save_game_config(...)
    local p = get_payload(...)
    local id = tostring(p.app_id or "")
    print("GSE: save_game_config for " .. id)
    
    if id == "" then return json.encode({ success = false, error = "No AppID detected" }) end

    configs[id] = { 
        interface_path = p.interface_path or "", 
        status_path = p.status_path or "" 
    }
    
    local ok = safe_write_file(settings_path, json.encode(configs))
    return json.encode({ success = ok })
end

function get_achievements(...)
    local p = get_payload(...)
    local id = tostring(p.app_id or "nil")
    print("GSE: get_achievements for " .. id)
    
    local cfg = configs[id]
    if not cfg then return json.encode({}) end
    
    local meta = safe_decode(safe_read_file(cfg.interface_path)) or {}
    local status = safe_decode(safe_read_file(cfg.status_path)) or {}
    
    local res = {}
    for _, ach in ipairs(meta) do
        if type(ach) == "table" and ach.name then
            local s = status[ach.name] or {}
            table.insert(res, {
                name = ach.name,
                display_name = ach.display_name or ach.name,
                unlocked = s.unlocked or false
            })
        end
    end
    return json.encode(res)
end

-- Lifecycle
local function on_load()
    print("GSE Achievements: Loading from " .. settings_path)
    local content = safe_read_file(settings_path)
    if content then configs = safe_decode(content) or {} end
    millennium.ready()
end

return {
    on_load = on_load,
    on_frontend_loaded = function() print("GSE: Frontend Connected") end,
    get_game_config = get_game_config,
    save_game_config = save_game_config,
    get_achievements = get_achievements,
    get_all_configs = function() return json.encode(configs) end
}
