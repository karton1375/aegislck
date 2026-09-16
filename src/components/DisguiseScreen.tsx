import React, { useState } from 'react';
import { Shield, Calculator, FileText, Activity, ArrowLeft } from 'lucide-react';

interface DisguiseScreenProps {
  type: 'notes' | 'calc' | 'fitness';
  onExit: () => void;
}

export const DisguiseScreen: React.FC<DisguiseScreenProps> = ({ type, onExit }) => {
  // Disguise Calculator State
  const [calcDisplay, setCalcDisplay] = useState<string>('0');
  const [calcMemory, setCalcMemory] = useState<number | null>(null);
  const [calcOp, setCalcOp] = useState<string | null>(null);
  const [secretTapCount, setSecretTapCount] = useState<number>(0);

  // Disguise Notes State
  const [notes, setNotes] = useState<string[]>(['Список покупок на вечер', 'Заметки по проекту #4', 'Замена масла ТО']);
  const [newNote, setNewNote] = useState<string>('');

  const handleSecretTap = () => {
    const next = secretTapCount + 1;
    if (next >= 3) {
      onExit();
    } else {
      setSecretTapCount(next);
      setTimeout(() => setSecretTapCount(0), 3000);
    }
  };

  const handleCalcNumber = (num: string) => {
    setCalcDisplay((prev) => (prev === '0' ? num : prev + num));
  };

  const handleCalcOp = (op: string) => {
    setCalcMemory(parseFloat(calcDisplay));
    setCalcOp(op);
    setCalcDisplay('0');
  };

  const handleCalcEquals = () => {
    if (calcMemory === null || calcOp === null) return;
    const current = parseFloat(calcDisplay);
    let res = 0;
    if (calcOp === '+') res = calcMemory + current;
    if (calcOp === '-') res = calcMemory - current;
    if (calcOp === '×') res = calcMemory * current;
    if (calcOp === '÷') res = current !== 0 ? calcMemory / current : 0;
    setCalcDisplay(String(res));
    setCalcMemory(null);
    setCalcOp(null);
  };

  return (
    <div id="disguise-full-screen" className="fixed inset-0 z-50 bg-[#08080A] text-white flex flex-col max-w-md mx-auto">
      {/* Top disguised bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E1E26] bg-[#121217]">
        <div
          onClick={handleSecretTap}
          className="flex items-center gap-2 cursor-pointer select-none"
        >
          {type === 'calc' && <Calculator size={18} className="text-[#A1A1AA]" />}
          {type === 'notes' && <FileText size={18} className="text-[#A1A1AA]" />}
          {type === 'fitness' && <Activity size={18} className="text-[#A1A1AA]" />}
          <span className="text-sm font-semibold tracking-tight text-white">
            {type === 'calc' ? 'Калькулятор' : type === 'notes' ? 'Заметки' : 'Фитнес-трекер'}
          </span>
        </div>

        {/* Exit camouflage button */}
        <button
          onClick={onExit}
          className="text-[11px] text-[#71717A] hover:text-[#FF2A85] flex items-center gap-1 bg-[#08080A] px-2.5 py-1 rounded-md border border-[#1E1E26]"
          title="Снять маскировку"
        >
          <ArrowLeft size={12} />
          <span>Выйти в Aegis</span>
        </button>
      </div>

      {/* Camouflage Body */}
      {type === 'calc' && (
        <div className="flex-1 flex flex-col justify-end p-5 space-y-3 pb-8">
          <div className="text-right font-mono text-4xl font-light text-white px-2 py-4 truncate">
            {calcDisplay}
          </div>

          <div className="grid grid-cols-4 gap-2 text-sm font-medium">
            {['C', '±', '%', '÷'].map((btn) => (
              <button
                key={btn}
                onClick={() => {
                  if (btn === 'C') setCalcDisplay('0');
                }}
                className="h-14 rounded-xl bg-[#1E1E26] text-[#A1A1AA] hover:bg-[#2D2D3A] text-lg font-semibold"
              >
                {btn}
              </button>
            ))}
            {['7', '8', '9', '×'].map((btn) => (
              <button
                key={btn}
                onClick={() => (btn === '×' ? handleCalcOp('×') : handleCalcNumber(btn))}
                className={`h-14 rounded-xl text-lg font-semibold ${
                  btn === '×' ? 'bg-[#FF2A85] text-white' : 'bg-[#121217] text-white hover:bg-[#1E1E26]'
                }`}
              >
                {btn}
              </button>
            ))}
            {['4', '5', '6', '-'].map((btn) => (
              <button
                key={btn}
                onClick={() => (btn === '-' ? handleCalcOp('-') : handleCalcNumber(btn))}
                className={`h-14 rounded-xl text-lg font-semibold ${
                  btn === '-' ? 'bg-[#FF2A85] text-white' : 'bg-[#121217] text-white hover:bg-[#1E1E26]'
                }`}
              >
                {btn}
              </button>
            ))}
            {['1', '2', '3', '+'].map((btn) => (
              <button
                key={btn}
                onClick={() => (btn === '+' ? handleCalcOp('+') : handleCalcNumber(btn))}
                className={`h-14 rounded-xl text-lg font-semibold ${
                  btn === '+' ? 'bg-[#FF2A85] text-white' : 'bg-[#121217] text-white hover:bg-[#1E1E26]'
                }`}
              >
                {btn}
              </button>
            ))}
            <button
              onClick={() => handleCalcNumber('0')}
              className="col-span-2 h-14 rounded-xl bg-[#121217] text-white text-lg font-semibold"
            >
              0
            </button>
            <button
              onClick={() => handleCalcNumber('.')}
              className="h-14 rounded-xl bg-[#121217] text-white text-lg font-semibold"
            >
              .
            </button>
            <button
              onClick={handleCalcEquals}
              className="h-14 rounded-xl bg-[#FF2A85] text-white text-lg font-semibold"
            >
              =
            </button>
          </div>
        </div>
      )}

      {type === 'notes' && (
        <div className="flex-1 p-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Новая запись..."
              className="flex-1 bg-[#121217] border border-[#1E1E26] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            />
            <button
              onClick={() => {
                if (newNote.trim()) {
                  setNotes([newNote.trim(), ...notes]);
                  setNewNote('');
                }
              }}
              className="px-4 py-2 bg-[#1E1E26] hover:bg-[#2D2D3A] text-xs font-semibold rounded-xl"
            >
              Добавить
            </button>
          </div>

          <div className="space-y-2">
            {notes.map((n, i) => (
              <div key={i} className="p-3 bg-[#121217] rounded-xl border border-[#1E1E26] text-xs text-[#A1A1AA]">
                {n}
              </div>
            ))}
          </div>
        </div>
      )}

      {type === 'fitness' && (
        <div className="flex-1 p-4 space-y-4">
          <div className="p-4 bg-[#121217] rounded-xl border border-[#1E1E26] text-center">
            <span className="text-xs text-[#71717A] block">Шаги сегодня</span>
            <div className="text-3xl font-bold font-mono text-white mt-1">8,412</div>
            <div className="text-[11px] text-emerald-400 mt-1">Цель 10,000 шагов (84%)</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 bg-[#121217] rounded-xl border border-[#1E1E26]">
              <span className="text-[11px] text-[#71717A]">Калории</span>
              <div className="text-lg font-bold font-mono text-white">480 ккал</div>
            </div>
            <div className="p-3 bg-[#121217] rounded-xl border border-[#1E1E26]">
              <span className="text-[11px] text-[#71717A]">Дистанция</span>
              <div className="text-lg font-bold font-mono text-white">5.8 км</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
