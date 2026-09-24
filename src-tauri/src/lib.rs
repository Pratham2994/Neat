//! Tauri shell: exposes the core engine to the UI, keeps Neat running in the tray, and watches Downloads.

mod watcher;

use neat_core::{ActionKind, ActivityEntry, Inbox, Neat, Outcome, RuleView};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, State, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

/// Started by Windows at sign-in: stay in the tray instead of opening the window.
const HIDDEN_ARG: &str = "--hidden";
/// Points Neat at another folder, for trying it on a copy of Downloads. Uses a separate history.
const TEST_FOLDER_ENV: &str = "NEAT_DOWNLOADS";

struct AppState {
    neat: Arc<Mutex<Neat>>,
    test_folder: bool,
    // Dropping the watcher stops it, so it lives as long as the app.
    _watcher: Option<notify::RecommendedWatcher>,
}

type CommandResult<T> = Result<T, String>;

fn with<T>(state: &State<'_, AppState>, f: impl FnOnce(&mut Neat) -> neat_core::Result<T>) -> CommandResult<T> {
    let mut neat = state.neat.lock().map_err(|_| "Neat hit an internal error. Restart it.".to_string())?;
    f(&mut neat).map_err(|e| e.to_string())
}

// `async` keeps file work off the window's main thread.

#[tauri::command(async)]
fn scan(app: AppHandle, state: State<'_, AppState>) -> CommandResult<Inbox> {
    let inbox = with(&state, |neat| neat.scan())?;
    update_tray(&app, &inbox);
    Ok(inbox)
}

/// The tray tooltip says whether a visit is worth it: "Neat: 5 groups to review".
pub(crate) fn update_tray(app: &AppHandle, inbox: &Inbox) {
    let tooltip = match inbox.stacks.len() {
        0 => "Neat: Downloads is tidy".to_string(),
        1 => "Neat: 1 group to review".to_string(),
        n => format!("Neat: {n} groups to review"),
    };
    if let Some(tray) = app.tray_by_id("neat") {
        let _ = tray.set_tooltip(Some(tooltip));
    }
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Settings {
    auto_rules: bool,
    start_at_login: bool,
    folder: String,
    test_folder: bool,
    version: String,
}

#[tauri::command(async)]
fn settings(app: AppHandle, state: State<'_, AppState>) -> CommandResult<Settings> {
    let (auto_rules, folder) = with(&state, |neat| Ok((neat.auto_rules()?, neat.root().to_string_lossy().into_owned())))?;
    Ok(Settings {
        auto_rules,
        start_at_login: app.autolaunch().is_enabled().unwrap_or(false),
        folder,
        test_folder: state.test_folder,
        version: app.package_info().version.to_string(),
    })
}

#[tauri::command(async)]
fn set_auto_rules(state: State<'_, AppState>, on: bool) -> CommandResult<()> {
    with(&state, |neat| neat.set_auto_rules(on))
}

#[tauri::command(async)]
fn set_start_at_login(app: AppHandle, on: bool) -> CommandResult<()> {
    let launcher = app.autolaunch();
    let result = if on { launcher.enable() } else { launcher.disable() };
    result.map_err(|e| format!("Windows did not accept the change: {e}"))
}

fn show_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn downloads_folder(app: &AppHandle) -> tauri::Result<(PathBuf, bool)> {
    if let Some(folder) = std::env::var_os(TEST_FOLDER_ENV).map(PathBuf::from).filter(|p| p.is_dir()) {
        return Ok((folder, true));
    }
    Ok((app.path().download_dir()?, false))
}

fn build_tray(app: &AppHandle, neat: Arc<Mutex<Neat>>) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Neat", true, None::<&str>)?;
    let scan = MenuItem::with_id(app, "scan", "Scan Downloads now", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Neat", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &scan, &PredefinedMenuItem::separator(app)?, &quit])?;
    let mut tray = TrayIconBuilder::with_id("neat").tooltip("Neat").menu(&menu).show_menu_on_left_click(false);
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.on_menu_event(move |app, event| match event.id.as_ref() {
        "open" => show_window(app),
        "scan" => {
            let (app, neat) = (app.clone(), neat.clone());
            std::thread::spawn(move || watcher::rescan(&app, &neat));
        }
        "quit" => app.exit(0),
        _ => {}
    })
    .on_tray_icon_event(|tray, event| {
        if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
            show_window(tray.app_handle());
        }
    })
    .build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be first: a second launch shows the running Neat instead of starting another.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_window(app)))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec![HIDDEN_ARG])))
        .setup(|app| {
            let handle = app.handle().clone();
            let (downloads, test_folder) = downloads_folder(&handle)?;
            let data = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data)?;
            // A test folder gets its own history, so trying Neat on a copy never touches the real log.
            let db = data.join(if test_folder { "neat-test.db" } else { "neat.db" });
            let neat = Neat::open(&downloads, db)?;
            neat.begin_session()?;
            let neat = Arc::new(Mutex::new(neat));

            let watcher = watcher::start(handle.clone(), &downloads, neat.clone()).ok();
            if let Ok(mut n) = neat.lock() {
                n.watching = watcher.is_some();
            }
            build_tray(&handle, neat.clone())?;
            app.manage(AppState { neat, test_folder, _watcher: watcher });

            if !std::env::args().any(|a| a == HIDDEN_ARG) {
                show_window(&handle);
            }
            Ok(())
        })
        // Closing the window keeps Neat in the tray, so rules keep working. Quit from the tray menu.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            scan,
            apply,
            apply_suggested,
            undo,
            activity,
            rules,
            set_rule_enabled,
            settings,
            set_auto_rules,
            set_start_at_login
        ])
        .run(tauri::generate_context!())
        .expect("error while running Neat");
}
