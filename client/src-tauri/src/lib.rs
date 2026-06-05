use std::process::Child;
use std::sync::Mutex;
use std::path::PathBuf;
use tauri::Manager;

struct ServerProcess(Mutex<Option<Child>>);

fn get_server_path(app: &tauri::App) -> PathBuf {
  // First, check if running in resource directory (prod)
  if let Ok(resource_dir) = app.path().resource_dir() {
    // Check for relative path structure due to glob prefix
    let prod_path_up = resource_dir.join("_up_/_up_/server/dist/src/main.js");
    if prod_path_up.exists() {
      return prod_path_up;
    }
    // Check if directly inside resource_dir
    let prod_path_direct = resource_dir.join("server/dist/src/main.js");
    if prod_path_direct.exists() {
      return prod_path_direct;
    }
  }
  // Fallback to dev path relative to current dir (client/src-tauri)
  let dev_path = std::env::current_dir()
    .unwrap_or_default()
    .join("../../server/dist/src/main.js");
  dev_path
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Add a panic hook to write crash logs next to the executable
  std::panic::set_hook(Box::new(|info| {
    let log_path = std::env::current_exe()
      .map(|p| p.parent().unwrap().join("tauri-crash.txt"))
      .unwrap_or_else(|_| std::path::PathBuf::from("tauri-crash.txt"));
    let _ = std::fs::write(log_path, format!("{:#?}", info));
  }));

  tauri::Builder::default()
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Spawning NestJS backend process in the background
      let server_path = get_server_path(app);
      let server_dir = server_path.parent()
        .and_then(|p| p.parent())
        .and_then(|p| p.parent())
        .unwrap_or(&server_path);

      let mut cmd = std::process::Command::new("node");
      cmd.arg(&server_path)
         .current_dir(server_dir);

      #[cfg(target_os = "windows")]
      {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
      }

      let child = cmd.spawn();

      match child {
        Ok(c) => {
          println!("NestJS backend process started successfully.");
          app.manage(ServerProcess(Mutex::new(Some(c))));
        }
        Err(e) => {
          eprintln!("Failed to start NestJS backend process: {:?}", e);
        }
      }

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|app_handle, event| {
      // Intercept exit event to kill background process
      if let tauri::RunEvent::Exit = event {
        if let Some(state) = app_handle.try_state::<ServerProcess>() {
          if let Ok(mut lock) = state.0.lock() {
            if let Some(mut child) = lock.take() {
              println!("Stopping NestJS backend process...");
              let _ = child.kill();
            }
          }
        }
      }
    });
}
