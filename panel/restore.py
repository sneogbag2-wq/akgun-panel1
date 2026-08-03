import re

with open(r"c:\Users\monds\Desktop\test\panel\src\pages\AiAnalyticsHubPage.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Move the Synchronous analytics calculations up
calcs_match = re.search(r"(  // Synchronous analytics calculations\n(?:  const [^\n]+\n)+)", content)
if calcs_match:
    calcs = calcs_match.group(1)
    content = content.replace(calcs, "")
    # Insert just before "// Distinct sales reps"
    content = content.replace("  // Distinct sales reps", calcs + "\n  // Distinct sales reps")

# 2. Add the UI markup back for Controls bar
markup = """      </div>

      {/* 2. Controls Bar: Scope Selector & Live Autocomplete Search */}
      <div className="ai-hub-controls">
        <div className="ai-hub-scope-pills">
          <button 
            className={`scope-pill ${scope === 'ALL' ? 'active' : ''}`}
            onClick={() => { setScope('ALL'); handleClearSearch(); }}
          >
            <i className="fa-solid fa-building-columns"></i> Şirket Geneli
          </button>
          <button 
            className={`scope-pill ${scope === 'CUSTOMER' ? 'active' : ''}`}
            onClick={() => setScope('CUSTOMER')}
          >
            <i className="fa-solid fa-user-tag"></i> Müşteri Bazlı
          </button>
          <button 
            className={`scope-pill ${scope === 'REP' ? 'active' : ''}`}
            onClick={() => setScope('REP')}
          >
            <i className="fa-solid fa-user-tie"></i> Plasiyer / Temsilci
          </button>
          <button 
            className={`scope-pill ${scope === 'LOGISTICS' ? 'active' : ''}`}
            onClick={() => { setScope('LOGISTICS'); setActiveTab('LOGISTICS'); }}
          >
            <i className="fa-solid fa-truck-fast"></i> Sevkiyat & Lojistik
          </button>
        </div>

        <div className="ai-hub-search-box">
          <div className="search-input-wrap">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input 
              type="text" 
              className="search-input-field"
              placeholder={
                scope === 'CUSTOMER' ? 'Müşteri adı veya 5000XXXXXX kodu yazın...' :
                scope === 'REP' ? 'Temsilci / Plasiyer adı yazın...' :
                'Müşteri, Temsilci veya Şirket Geneli Arama Yapın...'
              }
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
            />
            {searchQuery && (
              <button className="search-clear-btn" onClick={handleClearSearch}>✕</button>
            )}
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div className="search-suggestions-dropdown">
              {suggestions.map((item, idx) => (
                <div key={idx} className="suggestion-item" onClick={() => handleSelectSuggestion(item)}>
                  <div>
                    <div className="name">{item.name}</div>
                    <div className="sub">{item.type === 'CUSTOMER' ? `ID: ${item.id}` : 'Plasiyer / Temsilci'}</div>
                  </div>
                  <i className="fa-solid fa-chevron-right" style={{ fontSize: '12px', color: '#5C6479' }}></i>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. Top Eye-Level Günlü CFO AI Insight Banner */}"""

content = re.sub(r"      </div>\s*\{\/\* 3\. Top Eye-Level Günlü CFO AI Insight Banner \*\/\}", markup, content)

with open(r"c:\Users\monds\Desktop\test\panel\src\pages\AiAnalyticsHubPage.tsx", "w", encoding="utf-8") as f:
    f.write(content)
