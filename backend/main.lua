local millennium = require("millennium")

local function on_load()
    print("GSE Achievements: Backend ready.")
    millennium.ready()
end

local function on_frontend_loaded()
    print("GSE Achievements: Frontend loaded.")
end

local function on_unload()
    print("GSE Achievements: Backend unloaded.")
end

return {
    on_load = on_load,
    on_frontend_loaded = on_frontend_loaded,
    on_unload = on_unload
}
