import re
import sys

def process_file(filepath, name, pattern_str, replacement):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add React Query import
    if "import { useQuery }" not in content:
        content = content.replace("import { useState, useEffect } from 'react'", "import { useState, useEffect } from 'react'\nimport { useQuery } from '@tanstack/react-query'")
        content = content.replace("import { useEffect, useState, useMemo } from 'react'", "import { useEffect, useState, useMemo } from 'react'\nimport { useQuery } from '@tanstack/react-query'")

    pattern = re.compile(pattern_str, re.DOTALL)
    new_content = pattern.sub(replacement, content)
    
    if name == 'Dashboard':
        new_content = new_content.replace('liveEnemies={liveEnemies}', 'liveEnemies={dashboardData.liveEnemies}')
        new_content = new_content.replace('${statsSummary.research}', '${dashboardData.statsSummary.research}')
        new_content = new_content.replace('${statsSummary.bibles}', '${dashboardData.statsSummary.bibles}')
        new_content = new_content.replace('matchups={matchups}', 'matchups={dashboardData.matchups}')
        new_content = new_content.replace('activities.length', 'dashboardData.activities.length')
        new_content = new_content.replace('activities.map', 'dashboardData.activities.map')

    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'{name} replaced successfully')
    else:
        print(f'{name} failed to replace')


dashboard_pattern = r'  const \[liveEnemies, setLiveEnemies\] = useState\(\[\]\)\s+const \[activities, setActivities\] = useState\(\[\]\)\s+const \[statsSummary, setStatsSummary\] = useState\(\{ research: 0, bibles: 0 \}\)\s+const \[matchups, setMatchups\] = useState\(\[\]\)\s+useEffect\(\(\) => \{.*?\}, \[\]\)'

dashboard_repl = '''  const { data: dashboardData = { liveEnemies: [], activities: [], statsSummary: { research: 0, bibles: 0 }, matchups: [] }, isLoading } = useQuery({
    queryKey: ['dashboardData'],
    queryFn: async () => {
      let liveEnemies = []
      try {
        const { data } = await supabase
          .from('matchup_sentinel')
          .select('raw_data, updated_at')
          .eq('matchup_id', 'LIVE_MATCH')
          .maybeSingle()
        if (data && data.raw_data && data.raw_data.enemy_team) {
          const updatedAt = new Date(data.updated_at || Date.now()).getTime()
          if ((Date.now() - updatedAt) < 1000 * 60 * 120) {
            liveEnemies = data.raw_data.enemy_team
          }
        }
      } catch (e) { /* ignore */ }

      const [mRes, aRes, aCountRes] = await Promise.all([
        supabase.from('matchup_sentinel').select('*').order('created_at', { ascending: false }),
        supabase.from('bible_articles').select('id, title, created_at, champion').order('created_at', { ascending: false }).limit(5),
        supabase.from('bible_articles').select('*', { count: 'exact', head: true })
      ])

      const mData = mRes.data || []
      const combined = [
        ...mData.slice(0, 5).map(m => ({
          id: `m-${m.id}`,
          text: m.enemy === 'GLOBAL' ? `${m.champion} の辞典データを更新` : `${m.champion} vs ${m.enemy} の対策を記録`,
          time: m.created_at,
          raw_time: new Date(m.created_at).getTime()
        })),
        ...(aRes.data || []).map(a => ({
          id: `a-${a.id}`,
          text: `${a.champion} 攻略バイブルを錬成`,
          time: a.created_at,
          raw_time: new Date(a.created_at).getTime()
        }))
      ].sort((a, b) => b.raw_time - a.raw_time).slice(0, 10)

      return {
        liveEnemies,
        matchups: mData,
        activities: combined,
        statsSummary: {
          research: mData.length,
          bibles: aCountRes.count || 0
        }
      }
    }
  })'''

process_file('d:/my_work/99_ARCHIVE/04_COMMAND_CENTER_old/src/components/Dashboard.jsx', 'Dashboard', dashboard_pattern, dashboard_repl)

champdb_pattern = r'  const \[champions, setChampions\] = useState\(\[\]\)\s+const \[search, setSearch\] = useState.*?useEffect\(\(\) => \{.*?\}, \[\]\)'
champdb_repl = '''  const { data: champions = [], isLoading: loading } = useQuery({
    queryKey: ['championDB'],
    queryFn: async () => {
      let fetchedChampions = []
      const versions = await fetch('https://ddragon.leagueoflegends.com/api/versions.json').then(r => r.json())
      const latest = versions[0]
      const d = await fetch(`https://ddragon.leagueoflegends.com/cdn/${latest}/data/ja_JP/champion.json`).then(r => r.json())
      
      fetchedChampions = Object.values(d.data).map(c => ({
        id: c.id,
        key: c.key,
        name: c.name,
        title: c.title,
        tags: c.tags,
        searchKey: `${c.id.toLowerCase()} ${c.name}`
      }))
      
      const { data } = await supabase.from('matchup_sentinel').select('champion, created_at').eq('enemy', 'GLOBAL')
      const dates = {}
      if (data) {
        data.forEach(row => { dates[row.champion] = row.created_at })
      }
      return { champs: fetchedChampions, dates }
    }
  })

  const [search, setSearch] = useState('')
  const [sortOrder, setSortOrder] = useState('updated_desc')
  const [selected, setSelected] = useState(null)
  const champDates = champions?.dates || {}
  const championsList = champions?.champs || []'''

# Wait, `ChampionDB.jsx` has multiple useEffects. 
# It's better to just do Dashboard first.
