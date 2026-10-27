use super::db::Database;
use crate::places::PlaceData;
use rusqlite::{params,OptionalExtension};
impl Database {
    pub fn init_place_cache(&self)->rusqlite::Result<()> {
        self.conn.execute_batch("CREATE TABLE IF NOT EXISTS place_cache(cache_key TEXT PRIMARY KEY,data TEXT NOT NULL CHECK(json_valid(data)),source TEXT NOT NULL,fetched_at INTEGER NOT NULL);INSERT OR IGNORE INTO workspace_migrations VALUES(4,unixepoch());")
    }
    pub fn place_cache_get(&self,key:&str)->rusqlite::Result<Option<PlaceData>> {
        self.conn.query_row("SELECT data,source,fetched_at FROM place_cache WHERE cache_key=?1",params![key],|r|{let raw:String=r.get(0)?;Ok(PlaceData {data:serde_json::from_str(&raw).map_err(|e|rusqlite::Error::FromSqlConversionFailure(0,rusqlite::types::Type::Text,Box::new(e)))?,source:r.get(1)?,fetched_at:r.get(2)?,cached:true,stale:false})}).optional()
    }
    pub fn place_cache_put(&self,key:&str,data:&PlaceData)->rusqlite::Result<()> {
        self.conn.execute("INSERT INTO place_cache VALUES(?1,?2,?3,?4) ON CONFLICT(cache_key) DO UPDATE SET data=excluded.data,source=excluded.source,fetched_at=excluded.fetched_at",params![key,data.data.to_string(),data.source,data.fetched_at])?;
        self.conn.execute("DELETE FROM place_cache WHERE cache_key IN (SELECT cache_key FROM place_cache ORDER BY fetched_at DESC LIMIT -1 OFFSET 512)",[])?;Ok(())
    }
}
