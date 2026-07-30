import { Button, Input, Picker, ScrollView, Text, View } from '@tarojs/components'
import { useMemo, useState } from 'react'
import './index.scss'

type Player = {
  id: number
  name: string
  isHuman: boolean
  score: number
  wins: number
  maxHand: number
  dealerWins: number
}

type HandRecord = {
  hand: number
  dealerId: number
  winnerId: number
  points: number
  dealerStreak: number
}

const DEFAULT_NAMES = ['我', '南陵小智', '弋江阿虎机', '漳河小雀']
const HAND_OPTIONS = [4, 8, 12, 16]

function createPlayers(): Player[] {
  return DEFAULT_NAMES.map((name, id) => ({
    id,
    name,
    isHuman: id === 0,
    score: 0,
    wins: 0,
    maxHand: 0,
    dealerWins: 0,
  }))
}

export default function Index() {
  const [screen, setScreen] = useState<'setup' | 'game' | 'result'>('setup')
  const [totalHands, setTotalHands] = useState(8)
  const [players, setPlayers] = useState<Player[]>(createPlayers())
  const [records, setRecords] = useState<HandRecord[]>([])
  const [dealerId, setDealerId] = useState(0)
  const [dealerStreak, setDealerStreak] = useState(0)
  const [handNo, setHandNo] = useState(1)
  const [selectedWinner, setSelectedWinner] = useState(0)
  const [basePoints, setBasePoints] = useState('1')

  const ranking = useMemo(
    () => [...players].sort((a, b) => b.score - a.score || b.wins - a.wins),
    [players],
  )

  const startGame = () => {
    setPlayers(createPlayers())
    setRecords([])
    setDealerId(0)
    setDealerStreak(0)
    setHandNo(1)
    setSelectedWinner(0)
    setBasePoints('1')
    setScreen('game')
  }

  const finishHand = () => {
    const raw = Number(basePoints)
    const handPoints = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1
    const winnerIsDealer = selectedWinner === dealerId
    const nextStreak = winnerIsDealer ? dealerStreak + 1 : 0
    const awarded = handPoints + (winnerIsDealer ? nextStreak : 0)
    const loss = awarded

    const nextPlayers = players.map((player) => {
      if (player.id === selectedWinner) {
        return {
          ...player,
          score: player.score + loss * 3,
          wins: player.wins + 1,
          dealerWins: player.dealerWins + (winnerIsDealer ? 1 : 0),
          maxHand: Math.max(player.maxHand, awarded),
        }
      }
      return { ...player, score: player.score - loss }
    })

    const nextRecords = [
      ...records,
      {
        hand: handNo,
        dealerId,
        winnerId: selectedWinner,
        points: awarded,
        dealerStreak: nextStreak,
      },
    ]

    setPlayers(nextPlayers)
    setRecords(nextRecords)

    if (handNo >= totalHands) {
      setScreen('result')
      return
    }

    if (winnerIsDealer) {
      setDealerStreak(nextStreak)
    } else {
      setDealerId((dealerId + 1) % 4)
      setDealerStreak(0)
    }
    setHandNo(handNo + 1)
    setBasePoints('1')
  }

  if (screen === 'setup') {
    return (
      <View className='page setup-page'>
        <View className='hero-card'>
          <Text className='eyebrow'>南陵本地玩法</Text>
          <Text className='title'>九支麻将 · 人机版</Text>
          <Text className='subtitle'>四人对局，1名玩家 + 3名电脑，支持连庄与战绩统计。</Text>
        </View>

        <View className='panel'>
          <Text className='panel-title'>对局设置</Text>
          <View className='setting-row'>
            <View>
              <Text className='setting-label'>总对局数</Text>
              <Text className='setting-desc'>每局结算后自动进入下一局</Text>
            </View>
            <Picker
              mode='selector'
              range={HAND_OPTIONS.map((item) => `${item}局`)}
              value={HAND_OPTIONS.indexOf(totalHands)}
              onChange={(event) => setTotalHands(HAND_OPTIONS[Number(event.detail.value)])}
            >
              <View className='picker-value'>{totalHands}局</View>
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
          <Text className='eyebrow'>本场结束</Text>
          <Text className='title'>最终战绩</Text>
          <Text className='subtitle'>共完成 {records.length} 局</Text>
        </View>

        <View className='ranking-list'>
          {ranking.map((player, index) => (
            <View className='rank-card' key={player.id}>
              <Text className='rank-no'>#{index + 1}</Text>
              <View className={`avatar avatar-${player.id}`}>{player.name.slice(0, 1)}</View>
              <View className='rank-main'>
                <Text className='player-name'>{player.name}</Text>
                <Text className='rank-meta'>自摸 {player.wins} · 连庄胡 {player.dealerWins} · 单局最高 {player.maxHand}分</Text>
              </View>
              <Text className={player.score >= 0 ? 'score positive' : 'score negative'}>
                {player.score > 0 ? '+' : ''}{player.score}
              </Text>
            </View>
          ))}
        </View>

        <View className='panel'>
          <Text className='panel-title'>逐局记录</Text>
          {records.map((record) => (
            <View className='record-row' key={record.hand}>
              <Text>第{record.hand}局</Text>
              <Text>{players[record.winnerId].name} 自摸 {record.points}分</Text>
            </View>
          ))}
        </View>

        <Button className='primary-btn' onClick={() => setScreen('setup')}>再来一场</Button>
      </ScrollView>
    )
  }

  return (
    <ScrollView className='page game-page' scrollY>
      <View className='game-head'>
        <View>
          <Text className='eyebrow'>第 {handNo}/{totalHands} 局</Text>
          <Text className='game-title'>庄家：{players[dealerId].name}</Text>
        </View>
        <View className='streak-chip'>连庄 {dealerStreak}</View>
      </View>

      <View className='score-grid'>
        {players.map((player) => (
          <View className={`score-card ${player.id === dealerId ? 'dealer' : ''}`} key={player.id}>
            <View className={`avatar avatar-${player.id}`}>{player.name.slice(0, 1)}</View>
            <Text className='score-name'>{player.name}</Text>
            <Text className={player.score >= 0 ? 'score positive' : 'score negative'}>
              {player.score > 0 ? '+' : ''}{player.score}
            </Text>
            {player.id === dealerId && <Text className='dealer-badge'>庄</Text>}
          </View>
        ))}
      </View>

      <View className='panel settle-panel'>
        <Text className='panel-title'>本局结算</Text>
        <Text className='field-label'>选择自摸玩家</Text>
        <View className='winner-grid'>
          {players.map((player) => (
            <View
              key={player.id}
              className={`winner-option ${selectedWinner === player.id ? 'selected' : ''}`}
              onClick={() => setSelectedWinner(player.id)}
            >
              <Text>{player.name}</Text>
              {player.id === dealerId && <Text className='mini-dealer'>庄</Text>}
            </View>
          ))}
        </View>

        <Text className='field-label'>基础分</Text>
        <View className='input-wrap'>
          <Input
            className='score-input'
            type='number'
            value={basePoints}
            onInput={(event) => setBasePoints(event.detail.value)}
            placeholder='请输入牌型合计分'
          />
          <Text className='unit'>分</Text>
        </View>
        <Text className='tip'>庄家自摸时，系统会按当前连庄次数自动加分；胜者收取其余三家等额分数。</Text>
      </View>

      <Button className='primary-btn' onClick={finishHand}>
        {handNo >= totalHands ? '完成本场并查看战绩' : '结算并进入下一局'}
      </Button>
    </ScrollView>
  )
}
