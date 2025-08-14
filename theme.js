import { Appearance, Dimensions } from 'react-native';
const { width } = Dimensions.get('window');
const isDark = Appearance.getColorScheme() !== 'light';

export const palette = isDark
  ? { bg:'#0B0B0F', card:'#14141a', text:'#F2F2F5', sub:'#9EA3AE', accent:'#7C3AED', accent2:'#60A5FA', border:'#23232B' }
  : { bg:'#F6F7FB', card:'#FFFFFF', text:'#111827', sub:'#6B7280', accent:'#7C3AED', accent2:'#3B82F6', border:'#E5E7EB' };

export const spacing = n => n * 8;
export const radius = { md:16, lg:20 };
export const shadow = {
  shadowColor:'#000', shadowOpacity:isDark?0.25:0.08, shadowRadius:16, shadowOffset:{width:0,height:10}, elevation:3,
};
export const layout = { screenHMargin: Math.max(16, Math.min(24, width * 0.06)) };

