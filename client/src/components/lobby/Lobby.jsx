import { PRESET_COLORS } from '../../constants.js';

export default function Lobby({
  connected,
  nameInput,
  setNameInput,
  colorInput,
  setColorInput,
  roomIdInput,
  setRoomIdInput,
  handleJoin
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-[#070b13] relative overflow-y-auto min-h-full">
      {/* Glow Effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

      <div className="w-full max-w-md backdrop-blur-xl bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8 shadow-2xl z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Antigravity Canvas
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Real-time vector workspace. Design and move shapes together.
          </p>
        </div>

        <form onSubmit={handleJoin} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Display Name
            </label>
            <input
              type="text"
              required
              maxLength={20}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/50 transition"
              placeholder="Enter your name..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Cursor Color
            </label>
            <div className="flex flex-wrap gap-2.5 mb-3">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setColorInput(color)}
                  style={{ backgroundColor: color }}
                  className={`w-7 h-7 rounded-full transition-transform duration-150 ${
                    colorInput === color
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110'
                      : 'hover:scale-105'
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colorInput}
                onChange={(e) => setColorInput(e.target.value)}
                className="w-10 h-7 bg-transparent border-0 cursor-pointer rounded"
              />
              <span className="text-xs text-slate-400 font-mono">{colorInput}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Room ID
            </label>
            <input
              type="text"
              required
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/50 transition font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={!connected}
            className={`w-full py-3.5 px-4 rounded-xl font-semibold text-white shadow-lg transition-all duration-300 ${
              connected
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-[0.98]'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {connected ? 'Enter Workspace' : 'Connecting to Server...'}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="text-xs font-medium text-slate-500">
            {connected ? 'Socket Server Online' : 'Connecting to Server...'}
          </span>
        </div>
      </div>
    </div>
  );
}
