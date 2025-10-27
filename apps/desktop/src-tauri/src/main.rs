// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;
use std::fs;
use std::io::Write;
use std::net::TcpStream;
use std::path::PathBuf;
use base64::{Engine as _, engine::general_purpose};
use serde_json::Value;

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct PrinterConfig {
    host: String,
    port: u16,
    simulate: bool,
}

impl Default for PrinterConfig {
    fn default() -> Self {
        PrinterConfig {
            host: "127.0.0.1".to_string(),
            port: 9100,
            simulate: true,
        }
    }
}

fn load_printer_config() -> PrinterConfig {
    // Priority 1: Environment variables
    if let Ok(simulate) = env::var("PRINTER_SIMULATE") {
        return PrinterConfig {
            host: env::var("PRINTER_HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
            port: env::var("PRINTER_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(9100),
            simulate: simulate == "true",
        };
    }

    // Priority 2: Config file ~/.chefcloud/printer.json
    if let Some(home) = dirs::home_dir() {
        let config_path: PathBuf = home.join(".chefcloud").join("printer.json");
        if config_path.exists() {
            if let Ok(content) = fs::read_to_string(&config_path) {
                if let Ok(json) = serde_json::from_str::<Value>(&content) {
                    return PrinterConfig {
                        host: json["host"].as_str().unwrap_or("127.0.0.1").to_string(),
                        port: json["port"].as_u64().unwrap_or(9100) as u16,
                        simulate: json["simulate"].as_bool().unwrap_or(true),
                    };
                }
            }
        }
    }

    // Priority 3: Defaults
    PrinterConfig::default()
}

#[tauri::command]
fn print_receipt(base64_data: String) -> Result<String, String> {
    let config = load_printer_config();
    
    // Decode base64
    let bytes = general_purpose::STANDARD
        .decode(&base64_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    if config.simulate {
        println!("PRINT BYTES {}", bytes.len());
        Ok(format!("Simulated print: {} bytes", bytes.len()))
    } else {
        // Connect to printer via TCP
        let addr = format!("{}:{}", config.host, config.port);
        let mut stream = TcpStream::connect(&addr)
            .map_err(|e| format!("Failed to connect to printer at {}: {}", addr, e))?;

        stream.write_all(&bytes)
            .map_err(|e| format!("Failed to send data to printer: {}", e))?;

        Ok(format!("Printed {} bytes to {}", bytes.len(), addr))
    }
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![print_receipt])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
