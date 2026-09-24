//! Tauri shell: exposes the core engine to the UI as commands.

use neat_core::{ActionKind, ActivityEntry, Inbox, Neat, Outcome, RuleView};
use std::sync::Mutex;
use tauri::{Manager, State};

struct AppState(Mutex<Neat>);

type CommandResult<T> = Result<T, String>;

fn with<T>(state: &State<'_, AppState>, f: impl FnOnce(&mut Neat) -> neat_core::Result<T>) -> CommandResult<T> {
    let mut neat = state.0.lock().map_err(|_| "Neat hit an internal error. Restart it.".to_string())?;
    f(&mut neat).map_err(|e| e.to_string())
}

// `async` keeps file work off the window's main thread.

#[tauri::command(async)]
fn scan(state: State<'_, AppState>) -> CommandResult<Inbox> {
    with(&state, |neat| neat.scan())
}

#[tauri::command(async)]
fn apply(state: State<'_, AppState>, stack_id: String, action: ActionKind, always: bool) -> CommandResult<Outcome> {
    with(&state, |neat| neat.apply(&stack_id, action, always))
}

#[tauri::command(async)]
fn apply_suggested(state: State<'_, AppState>, stack_ids: Vec<String>) -> CommandResult<Outcome> {
    with(&state, |neat| neat.apply_suggested(&stack_ids))
}

#[tauri::command(async)]
fn undo(state: State<'_, AppState>, activity_ids: Vec<String>) -> CommandResult<Outcome> {
    with(&state, |neat| neat.undo(&activity_ids))
}

#[tauri::command(async)]
fn activity(state: State<'_, AppState>, limit: Option<usize>) -> CommandResult<Vec<ActivityEntry>> {
    with(&state, |neat| neat.activity(limit.unwrap_or(200)))
}

#[tauri::command(async)]
fn rules(state: State<'_, AppState>) -> CommandResult<Vec<RuleView>> {
    with(&state, |neat| neat.rules())
}

#[tauri::command(async)]
fn set_rule_enabled(state: State<'_, AppState>, id: String, enabled: bool) -> CommandResult<()> {
    with(&state, |neat| neat.set_rule_enabled(&id, enabled))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let downloads = app.path().download_dir()?;
            let data = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data)?;
            let neat = Neat::open(downloads, data.join("neat.db"))?;
            neat.begin_session()?;
            app.manage(AppState(Mutex::new(neat)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![scan, apply, apply_suggested, undo, activity, rules, set_rule_enabled])
        .run(tauri::generate_context!())
        .expect("error while running Neat");
}
