import { emptyWorkspace, entity, validateWorkspace } from './workspace';
import type { Item, SupplierReference, Recipe } from '../../types/domain';
export function exampleWorkspace() {
  const state=emptyWorkspace();
  state.suppliers=[{...entity(),name:'Les Moulins · exemple',email:'',phone:'',lead_days:2,notes:'Fournisseur fictif pour les essais.'},{...entity(),name:'Marché frais · exemple',email:'',phone:'',lead_days:1,notes:'Fournisseur fictif pour les essais.'}];
  const entries: [string,Item['kind'],Item['unit'],number,number,string][]=[['Farine T55','ingredient','kg',25,29.5,'Épicerie'],['Beurre doux','ingredient','kg',1,8.9,'Crèmerie'],['Sucre roux','ingredient','kg',1,2.8,'Épicerie'],['Chocolat noir','ingredient','kg',1,12.5,'Épicerie'],['Œuf','ingredient','piece',30,8.4,'Crèmerie'],['Sachet kraft','packaging','piece',100,6,'Emballages']];
  entries.forEach(([name,kind,unit,quantity,price,category],index)=>{const item:Item={...entity(),name,kind,unit,category,code:`DEMO-${index+1}`,allergens:index===0?'Gluten':index===1?'Lait':index===4?'Œufs':'',cost_reference_id:null};const ref:SupplierReference={...entity(),item_id:item.id,supplier_id:state.suppliers[index===1||index===4?1:0].id,code:`REF-${index+1}`,packaging:index===0?'sac':'colis',pack_count:1,content_quantity:quantity,content_unit:unit,price_ht:price,minimum_packs:1};item.cost_reference_id=ref.id;state.items.push(item);state.references.push(ref);});
  const recipe:Recipe={...entity(),name:'Cookie chocolat',description:'Fiche d’essai : une fournée de 20 cookies, emballage compris.',category:'Pâtisserie',portions:20,lines:state.items.map((item,index)=>({id:crypto.randomUUID(),type:'item',target_id:item.id,quantity:[500,250,200,300,2,20][index],unit:index<4?'g':'piece',loss_percent:0})),preparation_minutes:25,hourly_cost:18,sale_price_ttc:3.5,vat_percent:10,target_food_percent:30,rounding:.1};
  state.recipes.push(recipe);return validateWorkspace(state);
}
