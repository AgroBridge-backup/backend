export default function Footer() {
  return (
    <footer className="bg-tierra-dark text-white/80 py-12 mt-20">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🥑</span>
          <span className="text-xl font-display font-bold tracking-wide text-white">AgroBridge</span>
          <span className="text-sm text-fresa bg-white/20 px-3 py-1 ml-4 rounded-xl">Powered by AgroBridge</span>
        </div>
        <div className="text-center md:text-right text-sm mt-6 md:mt-0">
          <div>
            Hecho con <span className="text-fresa text-xl">❤️</span> en Zamora, Michoacán 🇲🇽
          </div>
          <div className="mt-1 text-white/60">
            © 2025 AgroBridge. Todos los derechos reservados.
          </div>
        </div>
      </div>
      <div className="mt-8 text-center text-aguacate-light font-semibold text-base">
        Pronto: <span className="text-white">AgroGPT.ai — inteligencia artificial privada y ética para el campo mexicano.</span>
      </div>
    </footer>
  )
}