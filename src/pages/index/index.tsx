import { Button, Picker, ScrollView, Text, View } from '@tarojs/components'
import { useMemo, useState } from 'react'
import './index.scss'

type Suit = '万' | '条' | '筒'
type Tile = { id: string; suit: Suit; value: number }
type Player = {
  id: number
  name: string
  isHuman: boolean
  score: number
  hand: Tile[]
  discards: Tile[]
  melds: Tile[][]
}

const DEFAULT_NAMES = ['我', '南陵小智', '弋江阿虎机', '漳河小雀']
const ROUND_OPTIONS = [1, 2, 4, 8]
const SUITS: Suit[] = ['万', '条', '筒']

function createDeck(): Tile[] {
  const tiles: Tile[] = []
  SUITS.forEach((suit) => {
    for (let value = 1; value <= 9; value += 1) {
      for (let copy = 0; copy < 4; copy += 1) {
        tiles.push({ id: `${suit}-${value}-${copy}`, suit, value })
      }
    }
  })
  for (let i = tiles.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[tiles[i], tiles[j]] = [tiles[j], tiles[i]]
  }
  return tiles
}

function sortHand(hand: Tile[]) {
  const order: Record<Suit, number> = { 万: 0, 条: 1, 筒: 2 }
  return [...hand].sort((a, b) => order[a.suit] - order[b.suit] || a.value - b.value)
}

function tileText(tile: Tile) {
  return `${tile.value}${tile.suit}`
}

function createPlayers(): Player[] {
  return DEFAULT_NAMES.map((name, id) => ({
    id,
    name,
    isHuman: id === 0,
    score: 0,
    hand: [],
    discards: [],
    melds: [],
  }))
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

  const ranking = useMemo(() => [...players].sort((a, b) => b.score - a.score), [players])

  const dealRound = (roundNo: number, nextDealer: number) => {
    const deck = createDeck()
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
    setMessage(nextDealer === 0 ? '轮到你出牌' : `${nextPlayers[nextDealer].name}思考中…`)
    setScreen('game')
    if (nextDealer !== 0) setTimeout(() => aiTurn(nextDealer, nextPlayers, deck), 500)
  }

  const startGame = () => {
    setPlayers(createPlayers())
    dealRound(1, 0)
  }

  const drawTile = (playerId: number, sourcePlayers = players, sourceWall = wall) => {
    if (!sourceWall.length) return { nextPlayers: sourcePlayers, nextWall: sourceWall }
    const nextWall = [...sourceWall]
    const tile = nextWall.pop()!
    const nextPlayers = sourcePlayers.map((player) =>
      player.id === playerId ? { ...player, hand: sortHand([...player.hand, tile]) } : player,
    )
    return { nextPlayers, nextWall }
  }

  const discardFrom = (playerId: number, tileId: string, sourcePlayers = players, sourceWall = wall) => {
    const nextPlayers = sourcePlayers.map((player) => {
      if (player.id !== playerId) return player
      const tile = player.hand.find((item) => item.id === tileId)
      if (!tile) return player
      return {
        ...player,
        hand: player.hand.filter((item) => item.id !== tileId),
        discards: [...player.discards, tile],
      }
    })
    const nextTurn = (playerId + 1) % 4
    setPlayers(nextPlayers)
    setWall(sourceWall)
    setTurn(nextTurn)
    setSelectedTileId(null)
    if (nextTurn === 0) {
      const drawn = drawTile(0, nextPlayers, sourceWall)
      setPlayers(drawn.nextPlayers)
      setWall(drawn.nextWall)
      setMessage('你摸了一张牌，请出牌')
    } else {
      setMessage(`${nextPlayers[nextTurn].name}思考中…`)
      setTimeout(() => aiTurn(nextTurn, nextPlayers, sourceWall), 500)
    }
  }

  const aiTurn = (playerId: number, sourcePlayers = players, sourceWall = wall) => {
    const drawn = drawTile(playerId, sourcePlayers, sourceWall)
    const ai = drawn.nextPlayers[playerId]
    if (!ai.hand.length) return
    const index = Math.floor(Math.random() * ai.hand.length)
    const tile = ai.hand[index]
    discardFrom(playerId, tile.id, drawn.nextPlayers, drawn.nextWall)
  }

  const humanDiscard = () => {
    if (turn !== 0 || !selectedTileId) return
    discardFrom(0, selectedTileId)
  }

  const declareWin = () => {
    if (turn !== 0) return
    const updated = players.map((player) => ({
      ...player,
      score: player.id === 0 ? player.score + 3 : player.score - 1,
    }))
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
          <Text className='subtitle'>你和三名电脑玩家真实摸牌、出牌并完成整场对局。</Text>
        </View>

        <View className='panel'>
          <Text className='panel-title'>对局设置</Text>
          <View className='setting-row'>
            <View>
              <Text className='setting-label'>圈数</Text>
              <Text className='setting-desc'>每圈结束后自动进入下一圈</Text>
            </View>
            <Picker
              mode='selector'
              range={ROUND_OPTIONS.map((item) => `${item}圈`)}
              value={ROUND_OPTIONS.indexOf(rounds)}
              onChange={(event) => setRounds(ROUND_OPTIONS[Number(event.detail.value)])}
            >
              <View className='picker-value'>{rounds}圈</View>
            </Picker>
          </View>
        </View>

        <View className='panel'>
          <Text className='panel-title'>参赛玩家</Text>
          {DEFAULT_NAMES.map((name, index) => (
            <View className='player-row' key={name}>
              <View className={`avatar avatar-${index}`}>{name.slice(0, 1)}</View>
              <View className='player-copy'>
                <Text className='player-name'>{name}</Text>
                <Text className='player-role'>{index === 0 ? '真人玩家' : '电脑玩家'}</Text>
              </View>
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
          <Text className='title'>{winnerId === 0 ? '你胡牌了' : '对局结束'}</Text>
          <Text className='subtitle'>第 {currentRound}/{rounds} 圈</Text>
        </View>
        <View className='ranking-list'>
          {ranking.map((player, index) => (
            <View className='rank-card' key={player.id}>
              <Text className='rank-no'>#{index + 1}</Text>
              <View className={`avatar avatar-${player.id}`}>{player.name.slice(0, 1)}</View>
              <View className='rank-main'><Text className='player-name'>{player.name}</Text></View>
              <Text className={player.score >= 0 ? 'score positive' : 'score negative'}>
                {player.score > 0 ? '+' : ''}{player.score}
              </Text>
            </View>
          ))}
        </View>
        <Button className='primary-btn' onClick={nextRound}>
          {currentRound >= rounds ? '返回首页' : '进入下一圈'}
        </Button>
      </ScrollView>
    )
  }

  const human = players[0]
  return (
    <View className='table-page'>
      <View className='table-topbar'>
        <Text>第 {currentRound}/{rounds} 圈</Text>
        <Text>牌墙 {wall.length}</Text>
      </View>

      <View className='mahjong-table'>
        <View className='opponent opponent-top'>
          <Text className='opponent-name'>{players[2].name}</Text>
          <View className='back-row'>{players[2].hand.map((tile) => <View className='tile-back' key={tile.id} />)}</View>
        </View>
        <View className='opponent opponent-left'>
          <Text className='opponent-name'>{players[3].name}</Text>
          <Text className='tile-count'>{players[3].hand.length}张</Text>
        </View>
        <View className='opponent opponent-right'>
          <Text className='opponent-name'>{players[1].name}</Text>
          <Text className='tile-count'>{players[1].hand.length}张</Text>
        </View>

        <View className='center-info'>
          <Text className='dealer-text'>庄 {players[dealerId].name}</Text>
          <Text className='turn-text'>{message}</Text>
        </View>

        <View className='discard-area'>
          {players.flatMap((player) => player.discards).map((tile) => (
            <View className='discard-tile' key={tile.id}><Text>{tile.value}</Text><Text>{tile.suit}</Text></View>
          ))}
        </View>
      </View>

      <View className='human-area'>
        <View className='human-status'>
          <Text>{human.name}</Text>
          <Text>{turn === 0 ? '你的回合' : '等待对手'}</Text>
        </View>
        <ScrollView className='hand-scroll' scrollX>
          <View className='hand-row'>
            {human.hand.map((tile) => (
              <View
                key={tile.id}
                className={`mahjong-tile ${selectedTileId === tile.id ? 'selected' : ''}`}
                onClick={() => turn === 0 && setSelectedTileId(tile.id)}
              >
                <Text className='tile-number'>{tile.value}</Text>
                <Text className='tile-suit'>{tile.suit}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
        <View className='action-row'>
          <Button className='secondary-btn' disabled={turn !== 0} onClick={declareWin}>胡</Button>
          <Button className='primary-btn action-primary' disabled={turn !== 0 || !selectedTileId} onClick={humanDiscard}>
            {selectedTileId ? `打出 ${tileText(human.hand.find((tile) => tile.id === selectedTileId)!)}` : '请选择一张牌'}
          </Button>
        </View>
      </View>
    </View>
  )
}
