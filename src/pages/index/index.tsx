import { Button, Picker, ScrollView, Text, View } from '@tarojs/components'
import { useMemo, useRef, useState } from 'react'
import './index.scss'

type Suit = '万' | '条' | '筒'
type Honor = '东' | '南' | '西' | '北' | '中' | '发' | '白'
type Tile = {
  id: string
  kind: 'suit' | 'honor'
  suit?: Suit
  value?: number
  honor?: Honor
}
type Meld = { type: '碰' | '明杠' | '暗杠' | '补杠'; tiles: Tile[] }
type Player = {
  id: number
  name: string
  isHuman: boolean
  score: number
  hand: Tile[]
  discards: Tile[]
  melds: Meld[]
}
type LastDiscard = { playerId: number; tile: Tile } | null
type WinBreakdown = {
  total: number
  labels: string[]
  support: string
  specialWait: boolean
}

const DEFAULT_NAMES = ['我', '南陵小智', '弋江阿虎机', '漳河小雀']
const ROUND_OPTIONS = [1, 2, 4, 8]
const SUITS: Suit[] = ['万', '条', '筒']
const HONORS: Honor[] = ['东', '南', '西', '北', '中', '发', '白']
const SEATS = ['东', '南', '西', '北']
const SUIT_ORDER: Record<Suit, number> = { 万: 0, 条: 1, 筒: 2 }
const HONOR_ORDER: Record<Honor, number> = { 东: 0, 南: 1, 西: 2, 北: 3, 中: 4, 发: 5, 白: 6 }

function createDeck(): Tile[] {
  const tiles: Tile[] = []
  SUITS.forEach((suit) => {
    for (let value = 1; value <= 9; value += 1) {
      for (let copy = 0; copy < 4; copy += 1) tiles.push({ id: `${suit}-${value}-${copy}`, kind: 'suit', suit, value })
    }
  })
  HONORS.forEach((honor) => {
    for (let copy = 0; copy < 4; copy += 1) tiles.push({ id: `${honor}-${copy}`, kind: 'honor', honor })
  })
  for (let i = tiles.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[tiles[i], tiles[j]] = [tiles[j], tiles[i]]
  }
  return tiles
}

function tileCode(tile: Tile) {
  return tile.kind === 'honor' ? `z-${tile.honor}` : `${tile.suit}-${tile.value}`
}

function sameTile(a: Tile, b: Tile) {
  return tileCode(a) === tileCode(b)
}

function sortHand(hand: Tile[], wildcard?: Tile | null) {
  return [...hand].sort((a, b) => {
    if (wildcard) {
      const aWild = sameTile(a, wildcard)
      const bWild = sameTile(b, wildcard)
      if (aWild !== bWild) return aWild ? -1 : 1
    }
    if (a.kind !== b.kind) return a.kind === 'suit' ? -1 : 1
    if (a.kind === 'honor' && b.kind === 'honor') return HONOR_ORDER[a.honor!] - HONOR_ORDER[b.honor!]
    return SUIT_ORDER[a.suit!] - SUIT_ORDER[b.suit!] || a.value! - b.value!
  })
}

function tileText(tile: Tile) {
  return tile.kind === 'honor' ? tile.honor! : `${tile.value}${tile.suit}`
}

function tileNumeral(value: number) {
  return ['一', '二', '三', '四', '五', '六', '七', '八', '九'][value - 1]
}

function suitDots(value: number) {
  const layouts: Record<number, number[]> = {
    1: [5],
    2: [1, 9],
    3: [1, 5, 9],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9],
    7: [1, 3, 4, 5, 6, 7, 9],
    8: [1, 2, 3, 4, 6, 7, 8, 9],
    9: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  }
  return layouts[value] || []
}

function bambooBars(value: number) {
  if (value === 1) return [5]
  const positions = [1, 3, 4, 6, 7, 9, 2, 8]
  return positions.slice(0, value)
}

function TileFace({ tile, compact = false }: { tile: Tile; compact?: boolean }) {
  if (tile.kind === 'honor') {
    return <Text className={`face-honor honor-${tile.honor}`}>{tile.honor}</Text>
  }
  if (tile.suit === '万') {
    return (
      <View className='face-wan'>
        <Text className='wan-number'>{tileNumeral(tile.value!)}</Text>
        <Text className='wan-suit'>萬</Text>
      </View>
    )
  }
  if (tile.suit === '筒') {
    return (
      <View className={`face-grid face-dots ${compact ? 'compact' : ''}`}>
        {Array.from({ length: 9 }).map((_, index) => (
          <View className={`face-cell ${suitDots(tile.value!).includes(index + 1) ? 'visible' : ''}`} key={`dot-${tile.id}-${index}`}>
            <View className={`dot dot-${(index % 3) + 1}`} />
          </View>
        ))}
      </View>
    )
  }
  return (
    <View className={`face-grid face-bamboo ${compact ? 'compact' : ''}`}>
      {Array.from({ length: 9 }).map((_, index) => (
        <View className={`face-cell ${bambooBars(tile.value!).includes(index + 1) ? 'visible' : ''}`} key={`bar-${tile.id}-${index}`}>
          {tile.value === 1 && index === 4 ? <Text className='bird-mark'>雀</Text> : <View className={`bamboo bamboo-${(index % 3) + 1}`} />}
        </View>
      ))}
    </View>
  )
}

function nextWildcard(indicator: Tile): Tile {
  if (indicator.kind === 'suit') {
    const value = indicator.value === 9 ? 1 : indicator.value! + 1
    return { id: `wild-${indicator.suit}-${value}`, kind: 'suit', suit: indicator.suit, value }
  }
  const winds: Honor[] = ['东', '南', '西', '北']
  const dragons: Honor[] = ['中', '发', '白']
  const group = winds.includes(indicator.honor!) ? winds : dragons
  const index = group.indexOf(indicator.honor!)
  const honor = group[(index + 1) % group.length]
  return { id: `wild-${honor}`, kind: 'honor', honor }
}

function createPlayers(): Player[] {
  return DEFAULT_NAMES.map((name, id) => ({ id, name, isHuman: id === 0, score: 0, hand: [], discards: [], melds: [] }))
}

function countsWithoutWildcards(hand: Tile[], wildcard: Tile) {
  const counts = new Map<string, number>()
  let wildcards = 0
  hand.forEach((tile) => {
    if (sameTile(tile, wildcard)) wildcards += 1
    else counts.set(tileCode(tile), (counts.get(tileCode(tile)) || 0) + 1)
  })
  return { counts, wildcards }
}

function canFormSets(counts: Map<string, number>, wildcards: number): boolean {
  const keys = [...counts.keys()].filter((key) => (counts.get(key) || 0) > 0).sort()
  if (!keys.length) return wildcards % 3 === 0
  const key = keys[0]
  const count = counts.get(key) || 0

  const tripletNeed = Math.max(0, 3 - count)
  if (tripletNeed <= wildcards) {
    const next = new Map(counts)
    next.set(key, Math.max(0, count - 3))
    if (canFormSets(next, wildcards - tripletNeed)) return true
  }

  if (!key.startsWith('z-')) {
    const [suit, valueText] = key.split('-')
    const value = Number(valueText)
    if (value <= 7) {
      const next = new Map(counts)
      let need = 0
      ;[value, value + 1, value + 2].forEach((sequenceValue) => {
        const sequenceKey = `${suit}-${sequenceValue}`
        const current = next.get(sequenceKey) || 0
        if (current > 0) next.set(sequenceKey, current - 1)
        else need += 1
      })
      if (need <= wildcards && canFormSets(next, wildcards - need)) return true
    }
  }
  return false
}

function isSevenPairs(hand: Tile[], wildcard: Tile) {
  if (hand.length !== 14) return false
  const { counts, wildcards } = countsWithoutWildcards(hand, wildcard)
  let pairs = 0
  let singles = 0
  counts.forEach((count) => {
    pairs += Math.floor(count / 2)
    singles += count % 2
  })
  if (singles > wildcards) return false
  return pairs + singles + Math.floor((wildcards - singles) / 2) >= 7
}

function canHuBasic(hand: Tile[], melds: Meld[], wildcard: Tile) {
  if (hand.length + melds.length * 3 !== 14) return false
  if (!melds.length && isSevenPairs(hand, wildcard)) return true
  const { counts, wildcards } = countsWithoutWildcards(hand, wildcard)
  for (const key of [...counts.keys()]) {
    const count = counts.get(key) || 0
    const need = Math.max(0, 2 - count)
    if (need > wildcards) continue
    const next = new Map(counts)
    next.set(key, Math.max(0, count - 2))
    if (canFormSets(next, wildcards - need)) return true
  }
  return wildcards >= 2 && canFormSets(new Map(counts), wildcards - 2)
}

function allTiles(player: Player) {
  return [...player.hand, ...player.melds.flatMap((meld) => meld.tiles)]
}

function countSupports(player: Player, wildcard: Tile) {
  const counts: Record<Suit, number> = { 万: 0, 条: 0, 筒: 0 }
  allTiles(player).forEach((tile) => {
    if (tile.kind === 'suit' && !sameTile(tile, wildcard)) counts[tile.suit!] += 1
  })
  return counts
}

function isMissingOneSuit(player: Player) {
  const present = new Set(allTiles(player).filter((tile) => tile.kind === 'suit').map((tile) => tile.suit))
  return present.size <= 2
}

function isMixedOneSuit(player: Player) {
  const suits = new Set(allTiles(player).filter((tile) => tile.kind === 'suit').map((tile) => tile.suit))
  return suits.size === 1 && allTiles(player).some((tile) => tile.kind === 'honor')
}

function isPureOneSuit(player: Player) {
  const tiles = allTiles(player)
  return tiles.length > 0 && tiles.every((tile) => tile.kind === 'suit' && tile.suit === tiles[0].suit)
}

function isAllHonors(player: Player) {
  return allTiles(player).every((tile) => tile.kind === 'honor')
}

function isTopNine(player: Player, wildcard: Tile) {
  return SUITS.some((suit) => {
    const values = new Set(allTiles(player).filter((tile) => tile.kind === 'suit' && tile.suit === suit && !sameTile(tile, wildcard)).map((tile) => tile.value))
    return values.size === 9
  })
}

function hasFourIdentical(player: Player) {
  const counts = new Map<string, number>()
  allTiles(player).forEach((tile) => counts.set(tileCode(tile), (counts.get(tileCode(tile)) || 0) + 1))
  return [...counts.values()].some((count) => count >= 4)
}

function evaluateWin(player: Player, wildcard: Tile, flags: { selfDraw: boolean; afterKong: boolean }) : WinBreakdown | null {
  if (!canHuBasic(player.hand, player.melds, wildcard)) return null
  const labels: string[] = []
  let total = 0
  const sevenPairs = !player.melds.length && isSevenPairs(player.hand, wildcard)
  const mixed = isMixedOneSuit(player)
  const pure = isPureOneSuit(player)
  const allHonors = isAllHonors(player)
  const topNine = isTopNine(player, wildcard)
  const specialWait = player.hand.length === 2
  const fourSame = hasFourIdentical(player)

  if (allHonors) { labels.push('风清 20'); total += 20 }
  else if (pure) { labels.push('清一色 10'); total += 10 }
  else if (mixed) { labels.push('混一色 4'); total += 4 }
  if (sevenPairs) { labels.push('七对 4'); total += 4 }
  if (topNine) { labels.push('顶九 8'); total += 8 }
  if (specialWait) { labels.push('单吊 3'); total += 3 }
  if (flags.afterKong) { labels.push('杠开 1'); total += 1 }

  const supports = countSupports(player, wildcard)
  const maxSupport = Math.max(...Object.values(supports))
  const hasMajor = allHonors || pure || mixed || sevenPairs || topNine
  const exempt = specialWait || flags.afterKong || fourSame || hasMajor
  if (!isMissingOneSuit(player)) return null
  if (maxSupport < 9 && !exempt) return null
  if (maxSupport >= 9 && !allHonors && !pure) {
    const supportScore = maxSupport - 8
    labels.push(`${maxSupport}支 ${supportScore}`)
    total += supportScore
  }
  if (total <= 0) total = 1
  return { total, labels, support: `${maxSupport}支`, specialWait }
}

function chooseAiDiscard(hand: Tile[], wildcard: Tile) {
  const counts = new Map<string, number>()
  hand.forEach((tile) => counts.set(tileCode(tile), (counts.get(tileCode(tile)) || 0) + 1))
  const scored = hand.map((tile) => {
    if (sameTile(tile, wildcard)) return { tile, score: 999 }
    const count = counts.get(tileCode(tile)) || 0
    let score = count * 5
    if (tile.kind === 'suit') {
      score += hand.filter((other) => other.kind === 'suit' && other.suit === tile.suit && Math.abs(other.value! - tile.value!) <= 2).length
    }
    return { tile, score }
  })
  scored.sort((a, b) => a.score - b.score)
  return scored[0]?.tile || hand[0]
}

function getConcealedKong(hand: Tile[]) {
  const groups = new Map<string, Tile[]>()
  hand.forEach((tile) => groups.set(tileCode(tile), [...(groups.get(tileCode(tile)) || []), tile]))
  return [...groups.values()].find((tiles) => tiles.length >= 4)?.slice(0, 4) || null
}

function getUpgradeKong(player: Player) {
  const pong = player.melds.find((meld) => meld.type === '碰')
  if (!pong) return null
  const extra = player.hand.find((tile) => sameTile(tile, pong.tiles[0]))
  return extra ? { pong, extra } : null
}

export default function Index() {
  const [screen, setScreen] = useState<'setup' | 'game' | 'result'>('setup')
  const [rounds, setRounds] = useState(1)
  const [currentRound, setCurrentRound] = useState(1)
  const [players, setPlayers] = useState<Player[]>(createPlayers())
  const [wall, setWall] = useState<Tile[]>([])
  const [turn, setTurn] = useState(0)
  const [dealerId, setDealerId] = useState(0)
  const [dealerStreak, setDealerStreak] = useState(0)
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null)
  const [message, setMessage] = useState('轮到你出牌')
  const [winnerId, setWinnerId] = useState<number | null>(null)
  const [indicator, setIndicator] = useState<Tile | null>(null)
  const [wildcard, setWildcard] = useState<Tile | null>(null)
  const [lastDiscard, setLastDiscard] = useState<LastDiscard>(null)
  const [pendingAction, setPendingAction] = useState<'碰' | '杠' | null>(null)
  const [afterKongPlayer, setAfterKongPlayer] = useState<number | null>(null)
  const [resultText, setResultText] = useState('')
  const [showInfo, setShowInfo] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const ranking = useMemo(() => [...players].sort((a, b) => b.score - a.score), [players])
  const human = players[0]
  const concealedKong = wildcard ? getConcealedKong(human.hand.filter((tile) => !sameTile(tile, wildcard))) : null
  const upgradeKong = getUpgradeKong(human)

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }

  const scheduleAi = (playerId: number, sourcePlayers: Player[], sourceWall: Tile[], sourceWildcard: Tile) => {
    clearTimer()
    timerRef.current = setTimeout(() => aiTurn(playerId, sourcePlayers, sourceWall, sourceWildcard), 520)
  }

  const settleWin = (playerId: number, sourcePlayers: Player[], breakdown: WinBreakdown) => {
    const winnerIsDealer = playerId === dealerId
    const nextStreak = winnerIsDealer ? dealerStreak + 1 : 0
    const payment = breakdown.total + (winnerIsDealer ? nextStreak : 0)
    const updated = sourcePlayers.map((player) => player.id === playerId
      ? { ...player, score: player.score + payment * 3 }
      : { ...player, score: player.score - payment })
    setPlayers(updated)
    setDealerStreak(nextStreak)
    setWinnerId(playerId)
    setResultText(`${breakdown.labels.join(' + ')}${winnerIsDealer ? ` + 连庄${nextStreak}` : ''}，每家支付 ${payment} 分`)
    setScreen('result')
  }

  const dealRound = (roundNo: number, nextDealer: number) => {
    clearTimer()
    const deck = createDeck()
    const revealed = deck.pop()!
    deck.pop()
    const nextWild = nextWildcard(revealed)
    const nextPlayers = createPlayers().map((player) => ({ ...player, score: players[player.id]?.score || 0 }))
    for (let i = 0; i < 13; i += 1) nextPlayers.forEach((player) => { const tile = deck.pop(); if (tile) player.hand.push(tile) })
    const dealerTile = deck.pop()
    if (dealerTile) nextPlayers[nextDealer].hand.push(dealerTile)
    nextPlayers.forEach((player) => { player.hand = sortHand(player.hand, nextWild) })
    setPlayers(nextPlayers)
    setWall(deck)
    setTurn(nextDealer)
    setDealerId(nextDealer)
    setCurrentRound(roundNo)
    setSelectedTileId(null)
    setWinnerId(null)
    setIndicator(revealed)
    setWildcard(nextWild)
    setLastDiscard(null)
    setPendingAction(null)
    setAfterKongPlayer(null)
    setResultText('')
    setMessage(nextDealer === 0 ? '庄家先出牌' : `${nextPlayers[nextDealer].name}思考中…`)
    setScreen('game')
    if (nextDealer !== 0) scheduleAi(nextDealer, nextPlayers, deck, nextWild)
  }

  const startGame = () => {
    setPlayers(createPlayers())
    setDealerStreak(0)
    dealRound(1, 0)
  }

  const drawTile = (playerId: number, sourcePlayers: Player[], sourceWall: Tile[]) => {
    if (!sourceWall.length) return { nextPlayers: sourcePlayers, nextWall: sourceWall, tile: null as Tile | null }
    const nextWall = [...sourceWall]
    const tile = nextWall.pop()!
    const nextPlayers = sourcePlayers.map((player) => player.id === playerId ? { ...player, hand: sortHand([...player.hand, tile], wildcard) } : player)
    return { nextPlayers, nextWall, tile }
  }

  const promptHumanClaim = (discarded: Tile, sourcePlayers: Player[]) => {
    const matches = sourcePlayers[0].hand.filter((item) => sameTile(item, discarded)).length
    if (matches >= 3) return '杠' as const
    if (matches >= 2) return '碰' as const
    return null
  }

  const continueAfterDiscard = (playerId: number, sourcePlayers: Player[], sourceWall: Tile[], sourceWildcard: Tile) => {
    const nextTurn = (playerId + 1) % 4
    setTurn(nextTurn)
    setSelectedTileId(null)
    if (nextTurn === 0) {
      const drawn = drawTile(0, sourcePlayers, sourceWall)
      setPlayers(drawn.nextPlayers)
      setWall(drawn.nextWall)
      setLastDiscard(null)
      setPendingAction(null)
      setAfterKongPlayer(null)
      if (!drawn.tile) {
        setMessage('牌墙已空，本圈流局')
        setWinnerId(null)
        setResultText('牌墙摸完，无人胡牌')
        setScreen('result')
      } else setMessage(`你摸到 ${tileText(drawn.tile)}，请选择出牌`)
    } else {
      setMessage(`${sourcePlayers[nextTurn].name}思考中…`)
      scheduleAi(nextTurn, sourcePlayers, sourceWall, sourceWildcard)
    }
  }

  const maybeAiClaim = (playerId: number, discarded: Tile, sourcePlayers: Player[], sourceWall: Tile[], sourceWildcard: Tile) => {
    for (let offset = 1; offset <= 3; offset += 1) {
      const aiId = (playerId + offset) % 4
      if (aiId === 0) continue
      const ai = sourcePlayers[aiId]
      const matches = ai.hand.filter((tile) => sameTile(tile, discarded))
      if (matches.length >= 3 && sourceWall.length) {
        const ids = new Set(matches.slice(0, 3).map((tile) => tile.id))
        const nextPlayers = sourcePlayers.map((player) => {
          if (player.id === aiId) return { ...player, hand: player.hand.filter((tile) => !ids.has(tile.id)), melds: [...player.melds, { type: '明杠', tiles: [...matches.slice(0, 3), discarded] }] }
          if (player.id === playerId) return { ...player, discards: player.discards.slice(0, -1) }
          return player
        })
        const drawn = drawTile(aiId, nextPlayers, sourceWall)
        setPlayers(drawn.nextPlayers)
        setWall(drawn.nextWall)
        setLastDiscard(null)
        setAfterKongPlayer(aiId)
        setMessage(`${ai.name}明杠并补牌`)
        scheduleAi(aiId, drawn.nextPlayers, drawn.nextWall, sourceWildcard)
        return true
      }
      if (matches.length >= 2 && Math.random() < 0.48) {
        const ids = new Set(matches.slice(0, 2).map((tile) => tile.id))
        const nextPlayers = sourcePlayers.map((player) => {
          if (player.id === aiId) return { ...player, hand: player.hand.filter((tile) => !ids.has(tile.id)), melds: [...player.melds, { type: '碰', tiles: [...matches.slice(0, 2), discarded] }] }
          if (player.id === playerId) return { ...player, discards: player.discards.slice(0, -1) }
          return player
        })
        setPlayers(nextPlayers)
        setLastDiscard(null)
        setMessage(`${ai.name}碰牌`)
        scheduleAi(aiId, nextPlayers, sourceWall, sourceWildcard)
        return true
      }
    }
    return false
  }

  const discardFrom = (playerId: number, tileId: string, sourcePlayers: Player[], sourceWall: Tile[], sourceWildcard: Tile) => {
    let discarded: Tile | null = null
    const nextPlayers = sourcePlayers.map((player) => {
      if (player.id !== playerId) return player
      discarded = player.hand.find((item) => item.id === tileId) || null
      if (!discarded) return player
      return { ...player, hand: player.hand.filter((item) => item.id !== tileId), discards: [...player.discards, discarded] }
    })
    if (!discarded) return
    setPlayers(nextPlayers)
    setWall(sourceWall)
    setLastDiscard({ playerId, tile: discarded })
    setAfterKongPlayer(null)
    if (playerId !== 0) {
      const action = promptHumanClaim(discarded, nextPlayers)
      if (action) {
        setPendingAction(action)
        setTurn(0)
        setMessage(`对手打出 ${tileText(discarded)}，你可以${action}`)
        return
      }
    }
    if (maybeAiClaim(playerId, discarded, nextPlayers, sourceWall, sourceWildcard)) return
    continueAfterDiscard(playerId, nextPlayers, sourceWall, sourceWildcard)
  }

  const executeAiSelfKong = (playerId: number, sourcePlayers: Player[], sourceWall: Tile[], sourceWildcard: Tile) => {
    const ai = sourcePlayers[playerId]
    const concealed = getConcealedKong(ai.hand.filter((tile) => !sameTile(tile, sourceWildcard)))
    const upgrade = getUpgradeKong(ai)
    if (!concealed && !upgrade) return null
    const nextPlayers = sourcePlayers.map((player) => {
      if (player.id !== playerId) return player
      if (concealed) {
        const ids = new Set(concealed.map((tile) => tile.id))
        return { ...player, hand: player.hand.filter((tile) => !ids.has(tile.id)), melds: [...player.melds, { type: '暗杠', tiles: concealed }] }
      }
      return {
        ...player,
        hand: player.hand.filter((tile) => tile.id !== upgrade!.extra.id),
        melds: player.melds.map((meld) => meld === upgrade!.pong ? { type: '补杠', tiles: [...meld.tiles, upgrade!.extra] } : meld),
      }
    })
    const drawn = drawTile(playerId, nextPlayers, sourceWall)
    setPlayers(drawn.nextPlayers)
    setWall(drawn.nextWall)
    setAfterKongPlayer(playerId)
    setMessage(`${ai.name}${concealed ? '暗杠' : '补杠'}并补牌`)
    return drawn
  }

  const aiTurn = (playerId: number, sourcePlayers: Player[], sourceWall: Tile[], sourceWildcard: Tile) => {
    if (!sourceWall.length) {
      setWinnerId(null)
      setResultText('牌墙摸完，无人胡牌')
      setScreen('result')
      return
    }
    let drawn = drawTile(playerId, sourcePlayers, sourceWall)
    const selfKong = executeAiSelfKong(playerId, drawn.nextPlayers, drawn.nextWall, sourceWildcard)
    if (selfKong) drawn = selfKong
    const ai = drawn.nextPlayers[playerId]
    const breakdown = evaluateWin(ai, sourceWildcard, { selfDraw: true, afterKong: afterKongPlayer === playerId || !!selfKong })
    if (breakdown) {
      settleWin(playerId, drawn.nextPlayers, breakdown)
      return
    }
    const tile = chooseAiDiscard(ai.hand, sourceWildcard)
    discardFrom(playerId, tile.id, drawn.nextPlayers, drawn.nextWall, sourceWildcard)
  }

  const humanDiscard = () => {
    if (turn !== 0 || !selectedTileId || !wildcard) return
    discardFrom(0, selectedTileId, players, wall, wildcard)
  }

  const passClaim = () => {
    if (!pendingAction || !lastDiscard || !wildcard) return
    const from = lastDiscard.playerId
    setPendingAction(null)
    if (maybeAiClaim(from, lastDiscard.tile, players, wall, wildcard)) return
    continueAfterDiscard(from, players, wall, wildcard)
  }

  const declarePong = () => {
    if (pendingAction !== '碰' || !lastDiscard) return
    const tile = lastDiscard.tile
    const nextPlayers = players.map((player) => {
      if (player.id === 0) {
        const matches = player.hand.filter((item) => sameTile(item, tile)).slice(0, 2)
        const ids = new Set(matches.map((item) => item.id))
        return { ...player, hand: player.hand.filter((item) => !ids.has(item.id)), melds: [...player.melds, { type: '碰', tiles: [...matches, tile] }] }
      }
      if (player.id === lastDiscard.playerId) return { ...player, discards: player.discards.slice(0, -1) }
      return player
    })
    setPlayers(nextPlayers)
    setPendingAction(null)
    setLastDiscard(null)
    setTurn(0)
    setMessage('你碰牌成功，请打出一张牌')
  }

  const declareOpenKong = () => {
    if (pendingAction !== '杠' || !lastDiscard || !wildcard || !wall.length) return
    const tile = lastDiscard.tile
    const matches = players[0].hand.filter((item) => sameTile(item, tile)).slice(0, 3)
    const ids = new Set(matches.map((item) => item.id))
    const nextPlayers = players.map((player) => {
      if (player.id === 0) return { ...player, hand: player.hand.filter((item) => !ids.has(item.id)), melds: [...player.melds, { type: '明杠', tiles: [...matches, tile] }] }
      if (player.id === lastDiscard.playerId) return { ...player, discards: player.discards.slice(0, -1) }
      return player
    })
    const drawn = drawTile(0, nextPlayers, wall)
    setPlayers(drawn.nextPlayers)
    setWall(drawn.nextWall)
    setPendingAction(null)
    setLastDiscard(null)
    setTurn(0)
    setAfterKongPlayer(0)
    setMessage(`你明杠并补到 ${drawn.tile ? tileText(drawn.tile) : '空牌'}`)
  }

  const declareSelfKong = () => {
    if (!wildcard || turn !== 0 || !wall.length) return
    let nextPlayers = players
    let label = ''
    if (concealedKong) {
      const ids = new Set(concealedKong.map((tile) => tile.id))
      nextPlayers = players.map((player) => player.id === 0 ? { ...player, hand: player.hand.filter((tile) => !ids.has(tile.id)), melds: [...player.melds, { type: '暗杠', tiles: concealedKong }] } : player)
      label = '暗杠'
    } else if (upgradeKong) {
      nextPlayers = players.map((player) => player.id === 0 ? {
        ...player,
        hand: player.hand.filter((tile) => tile.id !== upgradeKong.extra.id),
        melds: player.melds.map((meld) => meld === upgradeKong.pong ? { type: '补杠', tiles: [...meld.tiles, upgradeKong.extra] } : meld),
      } : player)
      label = '补杠'
    } else return
    const drawn = drawTile(0, nextPlayers, wall)
    setPlayers(drawn.nextPlayers)
    setWall(drawn.nextWall)
    setAfterKongPlayer(0)
    setMessage(`你${label}并补到 ${drawn.tile ? tileText(drawn.tile) : '空牌'}`)
  }

  const declareWin = () => {
    if (turn !== 0 || !wildcard) return
    const breakdown = evaluateWin(players[0], wildcard, { selfDraw: true, afterKong: afterKongPlayer === 0 })
    if (!breakdown) {
      setMessage('当前牌型不符合缺一门、九支或例外胡牌条件')
      return
    }
    settleWin(0, players, breakdown)
  }

  const nextRound = () => {
    if (currentRound >= rounds) {
      setScreen('setup')
      return
    }
    const nextDealer = winnerId === dealerId ? dealerId : (dealerId + 1) % 4
    dealRound(currentRound + 1, nextDealer)
  }

  if (screen === 'setup') {
    return (
      <View className='page setup-page'>
        <View className='hero-card'>
          <Text className='eyebrow'>南陵本地玩法</Text>
          <Text className='title'>九支麻将 · 人机对局</Text>
          <Text className='subtitle'>136 张牌、赖子、碰杠、九支校验和本地牌型计分。</Text>
        </View>
        <View className='panel'>
          <Text className='panel-title'>对局设置</Text>
          <View className='setting-row'>
            <View><Text className='setting-label'>圈数</Text><Text className='setting-desc'>每圈结束后自动进入下一圈</Text></View>
            <Picker mode='selector' range={ROUND_OPTIONS.map((item) => `${item}圈`)} value={ROUND_OPTIONS.indexOf(rounds)} onChange={(event) => setRounds(ROUND_OPTIONS[Number(event.detail.value)])}>
              <View className='picker-value'>{rounds}圈</View>
            </Picker>
          </View>
        </View>
        <View className='panel'>
          <Text className='panel-title'>参赛玩家</Text>
          {DEFAULT_NAMES.map((name, index) => (
            <View className='player-row' key={name}>
              <View className={`avatar avatar-${index}`}>{name.slice(0, 1)}</View>
              <View className='player-copy'><Text className='player-name'>{name}</Text><Text className='player-role'>{index === 0 ? '真人玩家' : '电脑玩家'}</Text></View>
              <Text className='seat'>{SEATS[index]}</Text>
            </View>
          ))}
        </View>
        <Button className='primary-btn' onClick={startGame}>开始对局</Button>
      </View>
    )
  }

  if (screen === 'result') {
    return (
      <ScrollView className='page result-page' scrollY>
        <View className='result-hero'>
          <Text className='eyebrow'>本圈结束</Text>
          <Text className='title'>{winnerId === null ? '流局' : winnerId === 0 ? '你胡牌了' : `${players[winnerId].name}胡牌`}</Text>
          <Text className='subtitle'>{resultText}</Text>
        </View>
        <View className='ranking-list'>
          {ranking.map((player, index) => (
            <View className='rank-card' key={player.id}>
              <Text className='rank-no'>#{index + 1}</Text>
              <View className={`avatar avatar-${player.id}`}>{player.name.slice(0, 1)}</View>
              <View className='rank-main'><Text className='player-name'>{player.name}</Text><Text className='rank-meta'>副露 {player.melds.length} 组</Text></View>
              <Text className={player.score >= 0 ? 'score positive' : 'score negative'}>{player.score > 0 ? '+' : ''}{player.score}</Text>
            </View>
          ))}
        </View>
        <Button className='primary-btn' onClick={nextRound}>{currentRound >= rounds ? '返回首页' : '进入下一圈'}</Button>
      </ScrollView>
    )
  }

  const selectedTile = human.hand.find((tile) => tile.id === selectedTileId)
  const selectedTileCode = selectedTile ? tileCode(selectedTile) : null
  const wallCount = Math.max(8, Math.min(18, Math.ceil(wall.length / 4)))
  return (
    <View className='table-page'>
      <View className='game-stage'>
        <View className='table-topbar'>
          <Text className='round-label'>对局 {currentRound}/{rounds}</Text>
          <View className='remaining-box'><Text className='remaining-icon'>▰</Text><Text>还剩 {wall.length} 张</Text></View>
          <View className='wild-box'>
            <Text>翻 {indicator ? tileText(indicator) : '-'}</Text>
            <Text>赖 {wildcard ? tileText(wildcard) : '-'}</Text>
          </View>
        </View>

        <View className='mahjong-table'>
          <View className='table-pattern'>魅力南陵</View>
          <View className='wall wall-top'>{Array.from({ length: wallCount }).map((_, index) => <View className='wall-brick' key={`top-${index}`} />)}</View>
          <View className='wall wall-left'>{Array.from({ length: Math.max(6, wallCount - 5) }).map((_, index) => <View className='wall-brick' key={`left-${index}`} />)}</View>
          <View className='wall wall-right'>{Array.from({ length: Math.max(6, wallCount - 5) }).map((_, index) => <View className='wall-brick' key={`right-${index}`} />)}</View>

          <View className='side-tools left-tools'>
            <Button className='edge-tool' onClick={() => setShowInfo((value) => !value)}>⚙</Button>
            <View className='edge-tool'>局</View>
          </View>
          <View className='side-tools right-tools'>
            <View className='edge-tool'>···</View>
            <View className='edge-tool'>聊</View>
          </View>

          {[2, 3, 1].map((playerId) => (
            <View className={`player-hud hud-${playerId}`} key={`hud-${playerId}`}>
              <View className={`portrait avatar-${playerId}`}>{players[playerId].name.slice(0, 1)}</View>
              <View className='hud-copy'>
                <Text className='hud-name'>{players[playerId].name}</Text>
                <Text className='hud-score'>{players[playerId].score >= 0 ? '+' : ''}{players[playerId].score} 分</Text>
              </View>
              {dealerId === playerId && <Text className='dealer-badge'>庄</Text>}
            </View>
          ))}

          <View className='opponent opponent-top'>
            <View className='back-row'>{players[2].hand.map((tile) => <View className='tile-back' key={tile.id} />)}</View>
          </View>

          <View className='center-info'>
            <View className='direction-grid'>
              <Text>南</Text><Text>西</Text><Text>北</Text><Text>东</Text>
            </View>
            <Text className='round-digit'>{String(currentRound).padStart(2, '0')}</Text>
            <Text className='dealer-text'>庄 {players[dealerId].name}</Text>
            <Text className='turn-text'>{message}</Text>
          </View>

          {players.map((player) => (
            <View className={`discard-river river-${player.id}`} key={`river-${player.id}`}>
              {player.discards.map((tile, index) => (
                <View
                  className={`discard-tile suit-${tile.kind === 'suit' ? tile.suit : 'honor'} ${selectedTileCode === tileCode(tile) ? 'matched' : ''} ${index === player.discards.length - 1 ? 'latest' : ''}`}
                  key={tile.id}
                >
                  <TileFace tile={tile} compact />
                </View>
              ))}
            </View>
          ))}

          {showInfo && (
            <View className='match-info-panel'>
              <Text>当前庄家：{players[dealerId].name}</Text>
              <Text>连庄：{dealerStreak}</Text>
              <Text>牌墙：{wall.length}</Text>
              <Text>赖子：{wildcard ? tileText(wildcard) : '-'}</Text>
            </View>
          )}

          <View className='human-area'>
            <View className='human-status'>
              <View className='human-hud'>
                <View className='portrait avatar-0'>{human.name.slice(0, 1)}</View>
                <View><Text className='hud-name'>{human.name}</Text><Text className='hud-score'>{human.score >= 0 ? '+' : ''}{human.score} 分</Text></View>
                {dealerId === 0 && <Text className='dealer-badge'>庄</Text>}
              </View>
              <Text className='turn-state'>{turn === 0 ? '你的回合' : '等待对手'}</Text>
            </View>
            {!!human.melds.length && <ScrollView className='meld-scroll' scrollX><View className='meld-row'>{human.melds.map((meld, index) => <View className='meld-box' key={`${meld.type}-${index}`}><Text className='meld-type'>{meld.type}</Text>{meld.tiles.map((tile) => <Text key={tile.id}>{tileText(tile)}</Text>)}</View>)}</View></ScrollView>}
            <ScrollView className='hand-scroll' scrollX>
              <View className='hand-row'>
                {human.hand.map((tile) => (
                  <View key={tile.id} className={`mahjong-tile ${selectedTileId === tile.id ? 'selected' : ''} ${wildcard && sameTile(tile, wildcard) ? 'wildcard' : ''} suit-${tile.kind === 'suit' ? tile.suit : 'honor'}`} onClick={() => turn === 0 && !pendingAction && setSelectedTileId(tile.id)}>
                    {wildcard && sameTile(tile, wildcard) && <Text className='wild-mark'>赖</Text>}
                    <TileFace tile={tile} />
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>

          {pendingAction ? (
            <View className='action-row action-floating'>
              <Button className='round-action pass-action' onClick={passClaim}>过</Button>
              {pendingAction === '碰' && <Button className='round-action pong-action' onClick={declarePong}>碰</Button>}
              {pendingAction === '杠' && <Button className='round-action kong-action' onClick={declareOpenKong}>杠</Button>}
            </View>
          ) : (
            <View className='action-row action-floating'>
              {(concealedKong || upgradeKong) && <Button className='round-action kong-action' onClick={declareSelfKong}>杠</Button>}
              <Button className='round-action win-action' disabled={turn !== 0} onClick={declareWin}>胡</Button>
              <Button className='round-action pass-action' disabled={turn === 0}>过</Button>
              <Button className='round-action discard-action' disabled={turn !== 0 || !selectedTileId} onClick={humanDiscard}>{selectedTile ? `打${tileText(selectedTile)}` : '出牌'}</Button>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}
