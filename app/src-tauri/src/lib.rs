use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // ── System tray setup ──────────────────────────────────────────────
        .setup(|app| {
            // Build tray context menu
            let open_i = MenuItem::with_id(app, "open", "Open AscendOne", true, None::<&str>)?;
            let sep1   = PredefinedMenuItem::separator(app)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit AscendOne", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&open_i, &sep1, &quit_i])?;

            // Create tray icon using the bundled app icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("AscendOne — Your LOA Journal")
                .menu(&menu)
                // Left-click is handled manually via on_tray_icon_event
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.unminimize();
                            let _ = win.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // Single left-click → show & focus the window
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.unminimize();
                            let _ = win.set_focus();
                        }
                    }
                })
                .build(app)?;

            // ── Sleep/wake detector ────────────────────────────────────────
            // Spawns a background thread that ticks every 2 seconds.
            // If a tick takes >10s the machine was asleep — show the window.
            let wake_handle = app.handle().clone();
            std::thread::spawn(move || {
                let tick = std::time::Duration::from_secs(2);
                let wake_threshold = std::time::Duration::from_secs(10);
                loop {
                    let t = std::time::Instant::now();
                    std::thread::sleep(tick);
                    if t.elapsed() > wake_threshold {
                        // Machine just woke from sleep — restore window
                        if let Some(win) = wake_handle.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.unminimize();
                            let _ = win.set_focus();
                        }
                    }
                }
            });

            Ok(())
        })
        // ── Close button → hide to tray (not quit) ────────────────────────
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        // ── Plugins ───────────────────────────────────────────────────────
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .run(tauri::generate_context!())
        .expect("error while running AscendOne");
}
