import { HomeScreen } from "@web/components/home/HomeScreen";

/**
 * Главная страница сайта. Сама страница — серверный файл без логики: всё
 * содержимое живёт в клиентском HomeScreen, потому что оно целиком построено
 * на запросах TanStack Query, языке и выбранном городе.
 */
export default function HomePage() {
  return <HomeScreen />;
}
