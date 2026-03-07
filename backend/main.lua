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
local last_status_map = {}
local icon_cache = {}

-- Optimized Base64 Encoder for Lua 5.1/Luajit
local function base64_encode(data)
    local b = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    local t, n = {}, 0
    for i = 1, #data, 3 do
        local b1, b2, b3 = data:byte(i, i + 2)
        local c1 = math.floor(b1 / 4)
        local c2 = (b1 % 4) * 16 + math.floor((b2 or 0) / 16)
        local c3 = ((b2 or 0) % 16) * 4 + math.floor((b3 or 0) / 64)
        local c4 = (b3 or 0) % 64
        
        t[n + 1] = b:sub(c1 + 1, c1 + 1)
        t[n + 2] = b:sub(c2 + 1, c2 + 1)
        t[n + 3] = b2 and b:sub(c3 + 1, c3 + 1) or '='
        t[n + 4] = b3 and b:sub(c4 + 1, c4 + 1) or '='
        n = n + 4
    end
    return table.concat(t)
end

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

-- Robust Argument Parser
local function get_payload(...)
    local args = {...}
    for i, v in ipairs(args) do
        if type(v) == "table" and (v.app_id or v[1]) then return v end
        if type(v) == "string" then
            local decoded = safe_decode(v)
            if type(decoded) == "table" and decoded.app_id then return decoded end
            if v:match("^%d+$") then return { app_id = v, interface_path = args[i+1], status_path = args[i+2] } end
        end
    end
    return {}
end

-- Exposed Methods
function get_game_config(...)
    local p = get_payload(...)
    local id = tostring(p.app_id or "nil")
    return json.encode(configs[id] or {})
end

function save_game_config(...)
    local p = get_payload(...)
    local id = tostring(p.app_id or "")
    if id == "" then return json.encode({ success = false }) end
    configs[id] = { interface_path = p.interface_path, status_path = p.status_path }
    local ok = safe_write_file(settings_path, json.encode(configs))
    return json.encode({ success = ok })
end

function get_achievements(...)
    local p = get_payload(...)
    local id = p.app_id
    local cfg = configs[id]
    if not cfg then return json.encode({}) end
    
    local meta = safe_decode(safe_read_file(cfg.interface_path)) or {}
    local status = safe_decode(safe_read_file(cfg.status_path)) or {}
    
    local res = {}
    for _, ach in ipairs(meta) do
        if type(ach) == "table" and ach.name then
            local s = status[ach.name] or {}
            local is_unlocked = s.earned == true or s.earned == 1 or s.earned == "true"
            table.insert(res, {
                name = ach.name,
                display_name = ach.displayName or ach.name,
                description = ach.description or "",
                unlocked = is_unlocked,
                icon_path = is_unlocked and (ach.icon or ach.icongray) or (ach.icongray or ach.icon)
            })
        end
    end

    -- Sort: Unlocked first, then by name
    table.sort(res, function(a, b)
        if a.unlocked ~= b.unlocked then return a.unlocked end
        return a.display_name < b.display_name
    end)

    return json.encode(res)
end

function get_icon_base64(payload)
    local p = type(payload) == "table" and payload or { path = payload }
    local path = p.path or p[1]
    if not path or path == "" then return "" end
    
    -- Check global cache
    if icon_cache[path] then return icon_cache[path] end

    local raw = safe_read_file(path)
    if not raw then return "" end
    
    local data = "data:image/jpeg;base64," .. base64_encode(raw)
    icon_cache[path] = data
    return data
end

-- Lifecycle
local function on_load()
    local content = safe_read_file(settings_path)
    if content then configs = safe_decode(content) or {} end
    millennium.ready()
end

return {
    on_load = on_load,
    on_frontend_loaded = function() print("GSE Connected") end,
    get_game_config = get_game_config,
    save_game_config = save_game_config,
    get_achievements = get_achievements,
    get_icon_base64 = get_icon_base64
}
