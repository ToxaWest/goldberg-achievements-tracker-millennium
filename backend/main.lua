local millennium = require("millennium")
local json = require("json")

-- Resolve absolute path safely
local function get_plugin_dir()
    local path = "."
    if millennium.get_install_path then path = millennium.get_install_path() end
    return path:gsub("\\", "/"):gsub("/$", "")
end

local plugin_dir = get_plugin_dir()
local settings_path = plugin_dir .. "/settings.json"

local configs = {}
local last_status_map = {}

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

-- Extremely loud debug helper
local function dump_any(val, name, indent)
    indent = indent or ""
    print(indent .. tostring(name) .. " [" .. type(val) .. "]: " .. tostring(val))
    if type(val) == "table" then
        for k, v in pairs(val) do
            dump_any(v, k, indent .. "  ")
        end
    end
end

-- Robust Argument Parser
local function get_payload(payload, ...)
    print("GSE DEBUG: --- Incoming Call ---")
    dump_any(payload, "Payload")
    local extra = {...}
    if #extra > 0 then dump_any(extra, "Extra Args") end

    -- Case 1: Payload is already the table we want
    if type(payload) == "table" and (payload.app_id or payload[1]) then
        return {
            app_id = tostring(payload.app_id or payload[1]),
            interface_path = payload.interface_path or payload[2] or "",
            status_path = payload.status_path or payload[3] or ""
        }
    end

    -- Case 2: Payload is a string (JSON or raw ID)
    if type(payload) == "string" then
        local decoded = safe_decode(payload)
        if type(decoded) == "table" then
            return {
                app_id = tostring(decoded.app_id or decoded[1] or ""),
                interface_path = decoded.interface_path or decoded[2] or "",
                status_path = decoded.status_path or decoded[3] or ""
            }
        end
        -- Raw ID as first arg
        return {
            app_id = tostring(payload),
            interface_path = tostring(extra[1] or ""),
            status_path = tostring(extra[2] or "")
        }
    end

    return { app_id = "" }
end

-- Exposed Methods
function get_game_config(...)
    local p = get_payload(...)
    local id = p.app_id
    print("GSE: get_game_config for " .. id)
    local cfg = configs[id] or {}
    return json.encode(cfg)
end

function save_game_config(...)
    local p = get_payload(...)
    local id = p.app_id
    print("GSE: save_game_config for " .. id)
    
    if id == "" or id == "nil" then 
        return json.encode({ success = false, error = "Backend failed: No AppID in payload" }) 
    end

    configs[id] = { 
        interface_path = p.interface_path or "", 
        status_path = p.status_path or "" 
    }
    
    local ok = safe_write_file(settings_path, json.encode(configs))
    
    -- Refresh status
    if p.status_path and p.status_path ~= "" then
        local status_data = safe_decode(safe_read_file(p.status_path))
        if status_data then last_status_map[id] = status_data end
    end
    
    return json.encode({ success = ok })
end

function get_achievements(...)
    local p = get_payload(...)
    local id = p.app_id
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
    get_achievements = get_achievements
}
