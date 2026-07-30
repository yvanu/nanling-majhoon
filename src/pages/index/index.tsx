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
type Meld = { type: '碰' | '杠'; tiles: Tile[] }
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

const DEFAULT_NAMES = ['我', '南陵小智', '弋江阿虎机', '漳河小雀']
const ROUND_OPTIONS = [1, 2, 4, 8]
const SUITS: Suit[] = ['万', '条', '筒']
const HONORS: Honor[] = ['东', '南', '西', '北', '中', '发', '白']
const SUIT_ORDER: Record<Suit, number> = { 万: 0, 条: 1, 筒: 2 }
const HONOR_ORDER: Record<Honor, number> = { 东: 0, 南: 1, 西: 2, 北: 3, 中: 4, 发: 5, 白: 6 }

function createDeck(): Tile[] {
  const tiles: Tile[] = []
  SUITS.forEach((suit) => {
    for (let value = 1; value <= 9; value += 1) {
      for (let copy = 0; copy < 4; copy += 1) {
        tiles.push({ id: `${suit}-${value}-${copy}`, kind: 'suit', suit, value })
      }
    }
  })
  HONORS.forEach((honor) => {
    for (let copy = 0; copy < 4; copy += 1) {
      tiles.push({ id: `${honor}-${copy}`, kind: 'honor', honor })
    }
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

function sortHand(hand: Tile[]) {
  return [...hand].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'suit' ? -1 : 1
    if (a.kind === 'honor' && b.kind === 'honor') return HONOR_ORDER[a.honor!] - HONOR_ORDER[b.honor!]
    return SUIT_ORDER[a.suit!] - SUIT_ORDER[b.suit!] || a.value! - b.value!
  })
}

function tileText(tile: Tile) {
  return tile.kind === 'honor' ? tile.honor! : `${tile.value}${tile.suit}`
}

function nextWildcard(indicator: Tile): Tile {
  if (indicator.kind === 'suit') {
    return { id: `wild-${indicator.suit}-${indicator.value === 9 ? 1 : indicator.value! + 1}`, kind: 'suit', suit: indicator.suit, value: indicator.value === 9 ? 1 : indicator.value! + 1 }
  }
  const index = HONORS.indexOf(indicator.honor!)
  const group = index <= 3 ? HONORS.slice(0, 4) : HONORS.slice(4)
  const groupIndex = group.indexOf(indicator.honor!)
  return { id: `wild-${group[(groupIndex + 1) % group.length]}`, kind: 'honor', honor: group[(groupIndex + 1) % group.length] }
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

  const tryTriplet = () => {
    const need = Math.max(0, 3 - count)
    if (need > wildcards) return false
    const next = new Map(counts)
    next.set(key, Math.max(0, count - 3))
    return canFormSets(next, wildcards - need)
  }

  const trySequence = () => {
    if (key.startsWith('z-')) return false
    const [suit, valueText] = key.split('-')
    const value = Number(valueText)
    if (value > 7) return false
    const sequenceKeys = [`${suit}-${value}`, `${suit}-${value + 1}`, `${suit}-${value + 2}`]
    let need = 0
    const next = new Map(counts)
    sequenceKeys.forEach((sequenceKey) => {
      const current = next.get(sequenceKey) || 0
      if (current > 0) next.set(sequenceKey, current - 1)
      else need += 1
    })
    return need <= wildcards && canFormSets(next, wildcards - need)
  }

  return tryTriplet() || trySequence()
}

function canHu(hand: Tile[], melds: Meld[], wildcard: Tile) {
  if (hand.length + melds.length * 3 !== 14) return false
  const { counts, wildcards } = countsWithoutWildcards(hand, wildcard)
  const keys = [...counts.keys()]
  for (const key of keys) {
    const count = counts.get(key) || 0
    const need = Math.max(0, 2 - count)
    if (need > wildcards) continue
    const next = new Map(counts)
    next.set(key, Math.max(0, count - 2))
    if (canFormSets(next, wildcards - need)) return true
  }
  return wildcards >= 2 && canFormSets(new Map(counts), wildcards - 2)
}

function chooseAiDiscard(hand: Tile[], wildcard: Tile) {
  const counts = new Map<string, number>()
  hand.forEach((tile) => counts.set(tileCode(tile), (counts.get(tileCode(tile)) || 0) + 1))
  const scored = hand.map((tile) => {
    if (sameTile(tile, wildcard)) return { tile, score: 999 }
    const count = counts.get(tileCode(tile)) || 0
    let score = count * 4
    if (tile.kind === 'suit') {
      const nearby = hand.filter((other) => other.kind === 'suit' && other.suit === tile.suit && Math.abs(other.value! - tile.value!) <= 2).length
      score += nearby
    }
    return { tile, score }
  })
  scored.sort((a, b) => a.score - b.score)
  return scored[0]?.tile || hand[0]
}

export default function Index() {
  const [screen, setScreen] = useState<'setup' | 'game' | 'result'>('setup')
  const [rounds, setRounds] = useState(1)
  const [currentRound, setCurrentRound] = useState(1)
  const [players, setPlayers] = useState<Player[]>(createPlayers())
  const [wall, setWall] = useState<Tile[]>([])
  const [turn, setTurn] = useState(0)
  const [dealerId, setDealerId] = useState(0)
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null)
  const [message, setMessage] = useState('轮到你出牌')
  const [winnerId, setWinnerId] = useState<number | null>(null)
  const [indicator, setIndicator] = useState<Tile | null>(null)
  const [wildcard, setWildcard] = useState<Tile | null>(null)
  const [lastDiscard, setLastDiscard] = useState<LastDiscard>(null)
  const [pendingPong, setPendingPong] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const ranking = useMemo(() => [...players].sort((a, b) => b.score - a.score), [players])

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }

  const scheduleAi = (playerId: number, sourcePlayers: Player[], sourceWall: Tile[], sourceWildcard: Tile) => {
    clearTimer()
    timerRef.current = setTimeout(() => aiTurn(playerId, sourcePlayers, sourceWall, sourceWildcard), 550)
  }

  const dealRound = (roundNo: number, nextDealer: number) => {
    clearTimer()
    const deck = createDeck()
    const revealed = deck.pop()!
    deck.pop()
    const nextWild = nextWildcard(revealed)
    const nextPlayers = createPlayers().map((player) => ({ ...player, score: players[player.id]?.score || 0 }))
    for (let i = 0; i < 13; i += 1) {
      nextPlayers.forEach((player) => {
        const tile = deck.pop()
        if (tile) player.hand.push(tile)
      })
    }
    const dealerTile = deck.pop()
    if (dealerTile) nextPlayers[nextDealer].hand.push(dealerTile)
    nextPlayers.forEach((player) => { player.hand = sortHand(player.hand) })
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
    setPendingPong(false)
    setMessage(nextDealer === 0 ? '轮到你出牌' : `${nextPlayers[nextDealer].name}思考中…`)
    setScreen('game')
    if (nextDealer !== 0) scheduleAi(nextDealer, nextPlayers, deck, nextWild)
  }

  const startGame = () => {
    setPlayers(createPlayers())
    dealRound(1, 0)
  }

  const drawTile = (playerId: number, sourcePlayers: Player[], sourceWall: Tile[]) => {
    if (!sourceWall.length) return { nextPlayers: sourcePlayers, nextWall: sourceWall, tile: null as Tile | null }
    const nextWall = [...sourceWall]
    const tile = nextWall.pop()!
    const nextPlayers = sourcePlayers.map((player) => player.id === playerId ? { ...player, hand: sortHand([...player.hand, tile]) } : player)
    return { nextPlayers, nextWall, tile }
  }

  const checkHumanPong = (tile: Tile, sourcePlayers: Player[]) => sourcePlayers[0].hand.filter((item) => sameTile(item, tile)).length >= 2

  const continueAfterDiscard = (playerId: number, sourcePlayers: Player[], sourceWall: Tile[], sourceWildcard: Tile) => {
    const nextTurn = (playerId + 1) % 4
    setTurn(nextTurn)
    setSelectedTileId(null)
    if (nextTurn === 0) {
      const drawn = drawTile(0, sourcePlayers, sourceWall)
      setPlayers(drawn.nextPlayers)
      setWall(drawn.nextWall)
      setLastDiscard(null)
      setPendingPong(false)
      setMessage(drawn.tile ? `你摸到 ${tileText(drawn.tile)}，请选择出牌` : '牌墙已空')
    } else {
      setMessage(`${sourcePlayers[nextTurn].name}思考中…`)
      scheduleAi(nextTurn, sourcePlayers, sourceWall, sourceWildcard)
    }
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
    if (playerId !== 0 && checkHumanPong(discarded, nextPlayers)) {
      setPendingPong(true)
      setTurn(0)
      setMessage(`对手打出 ${tileText(discarded)}，你可以碰`)
      return
    }
    continueAfterDiscard(playerId, nextPlayers, sourceWall, sourceWildcard)
  }

  const aiTurn = (playerId: number, sourcePlayers: Player[], sourceWall: Tile[], sourceWildcard: Tile) => {
    if (!sourceWall.length) {
      setMessage('牌墙已空，本圈流局')
      setWinnerId(null)
      setScreen('result')
      return
    }
    const drawn = drawTile(playerId, sourcePlayers, sourceWall)
    const ai = drawn.nextPlayers[playerId]
    if (canHu(ai.hand, ai.melds, sourceWildcard)) {
      const updated = drawn.nextPlayers.map((player) => ({ ...player, score: player.id === playerId ? player.score + 3 : player.score - 1 }))
      setPlayers(updated)
      setWinnerId(playerId)
      setMessage(`${ai.name}自摸`)
      setScreen('result')
      return
    }
    const tile = chooseAiDiscard(ai.hand, sourceWildcard)
    discardFrom(playerId, tile.id, drawn.nextPlayers, drawn.nextWall, sourceWildcard)
  }

  const humanDiscard = () => {
    if (turn !== 0 || !selectedTileId || !wildcard) return
    discardFrom(0, selectedTileId, players, wall, wildcard)
  }

  const passPong = () => {
    if (!pendingPong || !lastDiscard || !wildcard) return
    setPendingPong(false)
    continueAfterDiscard(lastDiscard.playerId, players, wall, wildcard)
  }

  const declarePong = () => {
    if (!pendingPong || !lastDiscard) return
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
    setPendingPong(false)
    setLastDiscard(null)
    setTurn(0)
    setMessage('你碰牌成功，请打出一张牌')
  }

  const declareWin = () => {
    if (turn !== 0 || !wildcard) return
    const human = players[0]
    if (!canHu(human.hand, human.melds, wildcard)) {
      setMessage('当前牌型还不能胡')
      return
    }
    const updated = players.map((player) => ({ ...player, score: player.id === 0 ? player.score + 3 : player.score - 1 }))
    setPlayers(updated)
    setWinnerId(0)
    setScreen('result')
  }

  const nextRound = () => {
    if (currentRound >= rounds) {
      setScreen('setup')
      return
    }
    dealRound(currentRound + 1, (dealerId + 1) % 4)
  }

  if (screen === 'setup') {
    return (
      <View className='page setup-page'>
        <View className='hero-card'>
          <Text className='eyebrow'>南陵本地玩法</Text>
          <Text className='title'>九支麻将 · 人机对局</Text>
          <Text className='subtitle'>136张牌，含字牌与赖子；支持真实摸打、碰牌和基础胡牌校验。</Text>
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
              <Text className='seat'>{['东', '南', '西', '北'][index]}</Text>
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
          <Text className='subtitle'>第 {currentRound}/{rounds} 圈</Text>
        </View>
        <View className='ranking-list'>
          {ranking.map((player, index) => (
            <View className='rank-card' key={player.id}>
              <Text className='rank-no'>#{index + 1}</Text>
              <View className={`avatar avatar-${player.id}`}>{player.name.slice(0, 1)}</View>
              <View className='rank-main'><Text className='player-name'>{player.name}</Text></View>
              <Text className={player.score >= 0 ? 'score positive' : 'score negative'}>{player.score > 0 ? '+' : ''}{player.score}</Text>
            </View>
          ))}
        </View>
        <Button className='primary-btn' onClick={nextRound}>{currentRound >= rounds ? '返回首页' : '进入下一圈'}</Button>
      </ScrollView>
    )
  }

  const human = players[0]
  const selectedTile = human.hand.find((tile) => tile.id === selectedTileId)
  return (
    <View className='table-page'>
      <View className='table-topbar'>
        <Text>第 {currentRound}/{rounds} 圈</Text>
        <Text>牌墙 {wall.length}</Text>
        <Text>翻牌 {indicator ? tileText(indicator) : '-'}</Text>
        <Text>赖子 {wildcard ? tileText(wildcard) : '-'}</Text>
      </View>
      <View className='mahjong-table'>
        <View className='opponent opponent-top'><Text className='opponent-name'>{players[2].name}</Text><View className='back-row'>{players[2].hand.map((tile) => <View className='tile-back' key={tile.id} />)}</View></View>
        <View className='opponent opponent-left'><Text className='opponent-name'>{players[3].name}</Text><Text className='tile-count'>{players[3].hand.length}张</Text></View>
        <View className='opponent opponent-right'><Text className='opponent-name'>{players[1].name}</Text><Text className='tile-count'>{players[1].hand.length}张</Text></View>
        <View className='center-info'><Text className='dealer-text'>庄 {players[dealerId].name}</Text><Text className='turn-text'>{message}</Text></View>
        <View className='discard-area'>
          {players.flatMap((player) => player.discards.map((tile) => ({ playerId: player.id, tile }))).map(({ playerId, tile }) => (
            <View className='discard-tile' key={tile.id}><Text className='discard-owner'>{['东', '南', '西', '北'][playerId]}</Text><Text>{tileText(tile)}</Text></View>
          ))}
        </View>
      </View>
      <View className='human-area'>
        <View className='human-status'><Text>{human.name}</Text><Text>{turn === 0 ? '你的回合' : '等待对手'}</Text></View>
        {!!human.melds.length && <View className='meld-row'>{human.melds.map((meld, index) => <View className='meld-box' key={`${meld.type}-${index}`}><Text>{meld.type}</Text>{meld.tiles.map((tile) => <Text key={tile.id}>{tileText(tile)}</Text>)}</View>)}</View>}
        <ScrollView className='hand-scroll' scrollX>
          <View className='hand-row'>
            {human.hand.map((tile) => (
              <View key={tile.id} className={`mahjong-tile ${selectedTileId === tile.id ? 'selected' : ''} ${wildcard && sameTile(tile, wildcard) ? 'wildcard' : ''}`} onClick={() => turn === 0 && !pendingPong && setSelectedTileId(tile.id)}>
                <Text className='tile-number'>{tile.kind === 'honor' ? tile.honor : tile.value}</Text>
                <Text className='tile-suit'>{tile.kind === 'honor' ? '字' : tile.suit}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
        {pendingPong ? (
          <View className='action-row'>
            <Button className='secondary-btn' onClick={passPong}>过</Button>
            <Button className='primary-btn action-primary' onClick={declarePong}>碰 {lastDiscard ? tileText(lastDiscard.tile) : ''}</Button>
          </View>
        ) : (
          <View className='action-row'>
            <Button className='secondary-btn' disabled={turn !== 0} onClick={declareWin}>胡</Button>
            <Button className='primary-btn action-primary' disabled={turn !== 0 || !selectedTileId} onClick={humanDiscard}>{selectedTile ? `打出 ${tileText(selectedTile)}` : '请选择一张牌'}</Button>
          </View>
        )}
      </View>
    </View>
  )
}
